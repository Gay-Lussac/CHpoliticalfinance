"""Final votes of the National Council on the objects put to the people (Parliamentary Services of the Federal Assembly,
open data web service https://ws.parlament.ch/odata.svc). See docs/01-data-sources.md › G.

For each Swissvotes ballot, its parliamentary business number (gesch_nr) gives the business; among that business's
final votes ("Vote final" / "Schlussabstimmung") the right one is the one whose yes/no counts equal the Swissvotes counts (nrja/nrnein),
either way round: for a popular initiative Parliament votes on its recommendation decree, so "yes" in Parliament is
usually "no" to the initiative ("inverted"). A vote whose counts match neither way is not used.

Final votes never change: each business and each vote is fetched once and archived (`pa/…`).
Terms of use: attribution "Services du Parlement de l'Assemblée fédérale, Berne" with the download date; the data
must not be presented as an official publication.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import quote

import httpx

from . import settings
from .parse import ParseError

BASE = "https://ws.parlament.ch/odata.svc"
ARCHIVE_LANG = "pa"                     # 2 letters: raw_payload.lang is CHAR(2)
DECISION = {1: "yes", 2: "no", 3: "abstain", 4: "absent", 5: "absent", 6: "excused", 7: "president"}
TOLERANCE = 2          # counts may differ by a vote or two (later corrections)


@dataclass
class FinalVote:
    id: int
    business: str
    subject: str
    bill_title: str | None
    voted_at: datetime | None
    votings: list          # dicts: person_number, first_name, last_name, canton, group_code, decision


def _client() -> httpx.Client:
    return httpx.Client(headers={"User-Agent": settings.USER_AGENT, "Accept": "application/json"}, timeout=60,
                        follow_redirects=True)


def _get_all(client: httpx.Client, url: str) -> list[dict]:
    rows, pages = [], 0
    while url and pages < 20:
        r = client.get(url)
        r.raise_for_status()
        d = r.json().get("d")
        if isinstance(d, list):
            rows += d
            url = None
        elif isinstance(d, dict):
            rows += d.get("results", [])
            url = d.get("__next")
        else:
            raise ParseError("parlament: unexpected response")
        pages += 1
        time.sleep(0.3)
    return rows


def _date(v: str | None) -> datetime | None:
    """OData '/Date(1790934036907)/' -> UTC datetime."""
    if not v or not v.startswith("/Date("):
        return None
    ms = int(v[6:].split(")")[0].split("+")[0].split("-")[0])
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def fetch(archive, businesses: list[str]) -> tuple[int, list[str]]:
    """Fetch (once) the final votes of these businesses and their individual votings into the archive."""
    fetched, errors = 0, []
    with _client() as client:
        for business in businesses:
            path = f"final_votes/{business}"
            # Not fetched yet, or fetched before Parliament held the final vote: (re)fetch.
            if archive.latest(ARCHIVE_LANG, path) is None or not archive.load(ARCHIVE_LANG, path):
                try:
                    # The subject is in French or German depending on the vote, whatever the language asked for.
                    flt = quote(f"Language eq 'FR' and BusinessShortNumber eq '{business}' and "
                                "(Subject eq 'Vote final' or Subject eq 'Schlussabstimmung')")
                    rows = _get_all(client, f"{BASE}/Vote?$filter={flt}&$select=ID,BusinessShortNumber,Subject,"
                                            f"BillTitle,VoteEnd")
                    body = json.dumps(rows, ensure_ascii=False).encode()
                    archive.store(ARCHIVE_LANG, path, _sha(body), body)
                    fetched += 1
                except Exception as e:   # enrichment: never blocks the sync
                    errors.append(f"{business}: {e}")
                    continue
            for v in archive.load(ARCHIVE_LANG, path) or []:
                vpath = f"votings/{v['ID']}"
                if archive.latest(ARCHIVE_LANG, vpath) is not None:
                    continue
                try:
                    flt = quote(f"Language eq 'FR' and IdVote eq {int(v['ID'])}")
                    rows = _get_all(client, f"{BASE}/Voting?$filter={flt}&$select=PersonNumber,FirstName,LastName,"
                                            f"Canton,ParlGroupCode,Decision&$top=1000")
                    body = json.dumps(rows, ensure_ascii=False).encode()
                    archive.store(ARCHIVE_LANG, vpath, _sha(body), body)
                    fetched += 1
                except Exception as e:
                    errors.append(f"vote {v['ID']}: {e}")
    return fetched, errors


def _sha(body: bytes) -> str:
    import hashlib
    return hashlib.sha256(body).hexdigest()


def final_votes(archive, business: str) -> list[FinalVote]:
    out = []
    for v in archive.load(ARCHIVE_LANG, f"final_votes/{business}") or []:
        rows = archive.load(ARCHIVE_LANG, f"votings/{v['ID']}")
        if rows is None:
            continue
        votings = [{"person_number": int(r["PersonNumber"]), "first_name": (r.get("FirstName") or "").strip(),
                    "last_name": (r.get("LastName") or "").strip(), "canton": (r.get("Canton") or "")[:2] or None,
                    "group_code": (r.get("ParlGroupCode") or "")[:10] or None,
                    "decision": DECISION.get(int(r["Decision"]), "absent")}
                   for r in rows if str(r.get("PersonNumber", "")).isdigit() and str(r.get("Decision", "")).isdigit()]
        out.append(FinalVote(int(v["ID"]), business, v.get("Subject") or "", v.get("BillTitle"), _date(v.get("VoteEnd")),
                             votings))
    return out


def pick(votes: list[FinalVote], nr_yes: int | None, nr_no: int | None) -> tuple[FinalVote | None, bool, str]:
    """The final vote matching the Swissvotes counts, whether it is inverted, and a note for the report."""
    if nr_yes is None or nr_no is None:
        return None, False, "no Swissvotes counts"
    best = None
    for v in votes:
        y = sum(1 for x in v.votings if x["decision"] == "yes")
        n = sum(1 for x in v.votings if x["decision"] == "no")
        for inverted, (a, b) in ((False, (y, n)), (True, (n, y))):
            d = abs(a - nr_yes) + abs(b - nr_no)
            if best is None or d < best[0]:
                best = (d, v, inverted)
    if best is None:
        return None, False, "no final vote found"
    if best[0] > TOLERANCE:
        return None, False, f"counts differ from Swissvotes by {best[0]}"
    return best[1], best[2], "ok"


def load(conn, archive, ballots: list) -> dict:
    """Replace parl_vote / parl_voting with the final votes matched to these Swissvotes ballots (one transaction).
    Returns counts and problems for the run report; skips silently before migration 006."""
    c = conn.cursor()
    c.execute("SHOW TABLES LIKE 'parl_voting'")
    if c.fetchone() is None:
        return {}
    c.execute("SELECT anr, id FROM ballot")
    ballot_ids = dict(c.fetchall())
    today = datetime.now(timezone.utc).date()
    matched, problems = [], []
    for b in ballots or []:
        if not b.business or b.anr not in ballot_ids or b.nr_yes is None:   # upcoming votes included
            continue
        vote, inverted, note = pick(final_votes(archive, b.business), b.nr_yes, b.nr_no)
        if vote is None:
            problems.append(f"{b.anr} ({b.business}): {note}")
            continue
        matched.append((ballot_ids[b.anr], vote, inverted))
    try:
        c.execute("DELETE FROM parl_voting")
        c.execute("DELETE FROM parl_vote")
        seen = set()
        for ballot_id, v, inverted in matched:
            if v.id in seen:                 # one parliamentary vote can serve one ballot only
                continue
            seen.add(v.id)
            c.execute("INSERT INTO parl_vote (id, ballot_id, council, business, bill_title, voted_at, inverted, fetched_at) "
                      "VALUES (%s,%s,'NR',%s,%s,%s,%s,%s)",
                      (v.id, ballot_id, v.business, (v.bill_title or "")[:500] or None,
                       v.voted_at.replace(tzinfo=None) if v.voted_at else None, inverted, today))
            c.executemany("INSERT IGNORE INTO parl_voting VALUES (%s,%s,%s,%s,%s,%s,%s)",
                          [(v.id, x["person_number"], x["first_name"][:120], x["last_name"][:120], x["canton"],
                            x["group_code"], x["decision"]) for x in v.votings])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"final_votes": len(seen), "votings": sum(len(v.votings) for _, v, _ in matched if v.id in seen),
            "problems": problems}
