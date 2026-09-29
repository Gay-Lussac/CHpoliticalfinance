"""Swissvotes dataset (Année politique suisse, University of Bern; CC BY 4.0): ballot questions,
results, party/organisation recommendations and English short titles. See docs/01-data-sources.md › B.

The whole dataset is one CSV (~3 MB). It is fetched on every sync and archived only when it changed.
Codes are documented in the Swissvotes codebook (https://swissvotes.ch/page/dataset/codebook-de.pdf).
"""
from __future__ import annotations

import csv
import difflib
import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

import httpx
import yaml

from . import settings
from .parse import ParseError, fold

URL = "https://swissvotes.ch/page/dataset/swissvotes_dataset.csv"
ARCHIVE_LANG, ARCHIVE_PATH = "sv", "swissvotes_dataset"   # archive key (not an EFK language)

LEGAL_FORM = {"1": "mandatory_referendum", "2": "optional_referendum", "3": "popular_initiative",
              "4": "counter_proposal", "5": "tie_break"}
ROLE = {"4": "counter_proposal", "5": "tie_break"}          # everything else is the main question
OUTCOME = {"0": "rejected", "1": "accepted", "8": "counter_proposal_preferred", "9": "initiative_preferred"}
RECOMMENDATION = {"1": "yes", "2": "no", "3": "none", "4": "blank", "5": "free",
                  "8": "prefer_counter_proposal", "9": "prefer_initiative", "66": "none"}
# 9999 = organisation did not exist, "." / "" = unknown → no row
REQUIRED = {"anr", "datum", "rechtsform", "titel_off_f", "titel_kurz_d", "titel_kurz_f", "titel_kurz_e",
            "annahme", "volkja-proz", "bet", "kt-ja"}
MIN_SCORE = 0.6


@dataclass
class Ballot:
    anr: str
    vote_date: date
    legal_form: str
    role: str
    title_official_fr: str
    titles: dict                   # lang -> Swissvotes short title (de, fr, en)
    yes_share: Decimal | None
    turnout: Decimal | None
    outcome: str | None
    cantons_yes: Decimal | None
    recommendations: dict = field(default_factory=dict)   # recommender code -> recommendation


def fetch(client: httpx.Client | None = None) -> tuple[bytes, str]:
    own = client is None
    client = client or httpx.Client(headers={"User-Agent": settings.USER_AGENT}, timeout=120, follow_redirects=True)
    try:
        r = client.get(URL)
        r.raise_for_status()
    finally:
        if own:
            client.close()
    if not r.content.lstrip(b"\xef\xbb\xbf").startswith(b"anr;"):
        raise ParseError("swissvotes: unexpected CSV header")
    return r.content, hashlib.sha256(r.content).hexdigest()


def _num(value: str) -> Decimal | None:
    value = (value or "").strip()
    if value in ("", "."):
        return None
    try:
        return Decimal(value)
    except InvalidOperation as e:
        raise ParseError(f"swissvotes: not a number {value!r}") from e


def parse(body: bytes, since: date, recommender_codes: list[str]) -> list[Ballot]:
    """Ballots on or after `since`. Rejects the file if expected columns are missing."""
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")), delimiter=";")
    cols = set(reader.fieldnames or [])
    missing = REQUIRED - cols
    missing |= {f"p-{c}" for c in recommender_codes} - cols
    if missing:
        raise ParseError(f"swissvotes: missing columns {sorted(missing)}")
    out = []
    for row in reader:
        d, m, y = row["datum"].split(".")
        vote_date = date(int(y), int(m), int(d))
        if vote_date < since:
            continue
        form = row["rechtsform"].strip()
        if form not in LEGAL_FORM:
            raise ParseError(f"swissvotes {row['anr']}: unknown rechtsform {form!r}")
        outcome_code = row["annahme"].strip()
        b = Ballot(
            anr=row["anr"].strip(), vote_date=vote_date, legal_form=LEGAL_FORM[form], role=ROLE.get(form, "main"),
            title_official_fr=row["titel_off_f"].strip(),
            titles={k: row[f"titel_kurz_{s}"].strip() for k, s in (("de", "d"), ("fr", "f"), ("en", "e"))
                    if row[f"titel_kurz_{s}"].strip()},
            yes_share=_num(row["volkja-proz"]), turnout=_num(row["bet"]),
            outcome=OUTCOME.get(outcome_code) or ("moot" if form == "5" and outcome_code == "." and _num(row["bet"])
                                                  else None),
            cantons_yes=_num(row["kt-ja"]),
        )
        for code in recommender_codes:
            v = row[f"p-{code}"].strip()
            if v in RECOMMENDATION:
                b.recommendations[code] = RECOMMENDATION[v]
            elif v not in ("", ".", "9999"):
                raise ParseError(f"swissvotes {b.anr}: unknown recommendation code {v!r} for {code}")
        out.append(b)
    return out


def _score(financing_title: str, ballot: Ballot) -> float:
    """Similarity between an EFK vote title and a Swissvotes ballot. EFK titles of initiatives with a
    counter-proposal contain both official titles, so token containment matters as much as similarity."""
    f = fold(financing_title)
    best = 0.0
    for t in (ballot.title_official_fr, ballot.titles.get("fr", "")):
        t = fold(t)
        if not t:
            continue
        tokens = [w for w in re.findall(r"[a-z0-9]+", t) if len(w) > 2]
        contained = sum(w in f for w in tokens) / len(tokens) if tokens else 0.0
        best = max(best, difflib.SequenceMatcher(None, f, t).ratio(), contained)
    return best


def match(ballots: list[Ballot], votes: list[tuple[int, date, str]]) -> tuple[dict[str, int], list[str]]:
    """Map ballot anr -> EFK vote efk_id. votes = [(efk_id, date, fr title)].
    Manual entries in config/vote_numbers.yaml win. Returns (mapping, problems)."""
    overrides = yaml.safe_load((settings.CONFIG_DIR / "vote_numbers.yaml").read_text()) or {}
    overrides = {str(k): v for k, v in overrides.items()}
    by_date: dict[date, list] = {}
    for efk_id, d, title in votes:
        by_date.setdefault(d, []).append((efk_id, title))
    mapping, problems = {}, []
    for b in ballots:
        if b.anr in overrides:
            if overrides[b.anr] is not None:
                mapping[b.anr] = int(overrides[b.anr])
            continue
        candidates = by_date.get(b.vote_date, [])
        if not candidates:
            continue                     # a vote the EFK has no financing for (e.g. before 2024)
        scored = sorted(((_score(title, b), efk_id) for efk_id, title in candidates), reverse=True)
        best, efk_id = scored[0]
        runner_up = scored[1][0] if len(scored) > 1 else 0.0
        if best >= MIN_SCORE and best - runner_up >= 0.1:
            mapping[b.anr] = efk_id
        else:
            problems.append(f"swissvotes {b.anr} ({b.vote_date}, {b.titles.get('fr', '')!r}): no clear EFK match "
                            f"(best {best:.2f}, next {runner_up:.2f}) – add it to config/vote_numbers.yaml")
    return mapping, problems
