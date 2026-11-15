"""Federal vote results by canton (Federal Statistical Office, BFS; the data behind the VoteInfo app).
See docs/01-data-sources.md › H.

One JSON file per voting day (https://ogd-static.voteinfo-app.ch/v1/ogd/sd-t-17-02-YYYYMMDD-eidgAbstimmung.json,
listed on opendata.swiss) with results for Switzerland, cantons, districts and municipalities. A ballot's BFS id is its
Swissvotes number times ten (682.1 -> 6821). Files are archived; a voting day is fetched again while its results are
provisional and the vote is less than 120 days old (counts can be corrected in the days after a vote).
Terms: open use, source must be given ("Federal Statistical Office").
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import date, timedelta

import httpx

from . import settings
from .parse import ParseError

URL = "https://ogd-static.voteinfo-app.ch/v1/ogd/sd-t-17-02-{d:%Y%m%d}-eidgAbstimmung.json"
ARCHIVE_LANG = "bf"                   # 2 letters (raw_payload.lang is CHAR(2))
MAX_BYTES = 30 * 1024 * 1024
RECHECK_DAYS = 120
# BFS canton numbers (geoLevelnummer) -> codes
CANTONS = {1: "ZH", 2: "BE", 3: "LU", 4: "UR", 5: "SZ", 6: "OW", 7: "NW", 8: "GL", 9: "ZG", 10: "FR", 11: "SO", 12: "BS",
           13: "BL", 14: "SH", 15: "AR", 16: "AI", 17: "SG", 18: "GR", 19: "AG", 20: "TG", 21: "TI", 22: "VD", 23: "VS",
           24: "NE", 25: "GE", 26: "JU"}


def _path(d: date) -> str:
    return f"eidg/{d:%Y%m%d}"


def _provisional(payload) -> bool:
    try:
        return any(v.get("provisorisch") for v in payload["schweiz"]["vorlagen"])
    except (KeyError, TypeError):
        return True


def fetch(archive, days: list[date], today: date | None = None) -> tuple[int, list[str]]:
    """Fetch the results of past voting days that are missing, or still provisional and recent."""
    today = today or date.today()
    fetched, errors = 0, []
    with httpx.Client(headers={"User-Agent": settings.USER_AGENT}, timeout=120, follow_redirects=True) as client:
        for d in sorted(set(days)):
            if d > today:
                continue
            have = archive.load(ARCHIVE_LANG, _path(d))
            if have is not None and not (_provisional(have) and today - d < timedelta(days=RECHECK_DAYS)):
                continue
            try:
                r = client.get(URL.format(d=d))
                if r.status_code == 404:
                    continue                 # not published (yet)
                r.raise_for_status()
                if len(r.content) > MAX_BYTES or "schweiz" not in r.json():
                    raise ParseError("unexpected file")
                _, new = archive.store(ARCHIVE_LANG, _path(d), hashlib.sha256(r.content).hexdigest(), r.content)
                fetched += int(new)
            except Exception as e:           # enrichment: never blocks the sync
                errors.append(f"{d}: {e}")
    return fetched, errors


def canton_results(archive, vote_date: date, anr: str) -> list[dict]:
    """Per-canton result rows for one ballot, or [] when not available."""
    payload = archive.load(ARCHIVE_LANG, _path(vote_date))
    if not payload:
        return []
    try:
        want = int(round(float(anr) * 10))
    except ValueError:
        return []
    for v in payload.get("schweiz", {}).get("vorlagen", []):
        if int(v.get("vorlagenId", -1)) != want:
            continue
        out = []
        for k in v.get("kantone", []):
            code = CANTONS.get(int(k.get("geoLevelnummer", 0)))
            r = k.get("resultat") or {}
            if not code or r.get("jaStimmenInProzent") is None:
                continue
            out.append({"canton": code, "yes_share": round(float(r["jaStimmenInProzent"]), 2),
                        "yes": int(r.get("jaStimmenAbsolut") or 0), "no": int(r.get("neinStimmenAbsolut") or 0),
                        "eligible": int(r.get("anzahlStimmberechtigte") or 0) or None,
                        "turnout": round(float(r["stimmbeteiligungInProzent"]), 2)
                        if r.get("stimmbeteiligungInProzent") is not None else None,
                        "provisional": bool(v.get("provisorisch"))})
        return out
    return []


def load(conn, archive, ballots: list) -> dict:
    """Replace ballot_canton with the canton results of these ballots. Skips silently before migration 007."""
    c = conn.cursor()
    c.execute("SHOW TABLES LIKE 'ballot_canton'")
    if c.fetchone() is None:
        return {}
    c.execute("SELECT anr, id FROM ballot")
    ids = dict(c.fetchall())
    rows = []
    for b in ballots or []:
        if b.anr in ids:
            rows += [(ids[b.anr], r["canton"], r["yes_share"], r["yes"], r["no"], r["turnout"], r["provisional"], r["eligible"])
                     for r in canton_results(archive, b.vote_date, b.anr)]
    try:
        c.execute("DELETE FROM ballot_canton")
        c.execute("SHOW COLUMNS FROM ballot_canton LIKE 'eligible'")          # migration 009
        if c.fetchone() is not None:
            c.executemany("INSERT INTO ballot_canton (ballot_id, canton, yes_share, yes, no, turnout, provisional, eligible) "
                          "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", rows)
        else:
            c.executemany("INSERT INTO ballot_canton (ballot_id, canton, yes_share, yes, no, turnout, provisional) "
                          "VALUES (%s,%s,%s,%s,%s,%s,%s)", [r[:7] for r in rows])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"rows": len(rows), "ballots": len({r[0] for r in rows})}


# ----------------------------------------------------------------- donor cantons (homepage map)

_SUFFIX = re.compile(r"\b(" + "|".join(CANTONS.values()) + r")\.?$")
# Names donors use that are not the official municipality name (exonyms, old spellings).
_ALIASES = {"genf": "GE", "geneve": "GE", "neuenburg": "NE", "neuchatel": "NE", "berne": "BE", "zurich": "ZH", "zuerich": "ZH",
            "zurigo": "ZH", "bale": "BS", "basel": "BS", "basilea": "BS", "lucerne": "LU", "lucerna": "LU", "sitten": "VS",
            "stgall": "SG", "saintgall": "SG", "stgallen": "SG", "sangallo": "SG", "soleure": "SO", "solothurn": "SO",
            "coire": "GR", "schaffhouse": "SH", "bellinzone": "TI", "fribourg": "FR", "freiburg": "FR", "friburgo": "FR",
            "lausanne": "VD", "lugano": "TI", "sion": "VS", "biel": "BE", "bienne": "BE", "zug": "ZG", "zoug": "ZG"}
_SWISS = {"suisse", "schweiz", "svizzera", "switzerland", "ch", ""}


def _fold(s: str | None) -> str:
    return re.sub(r"[^a-z]", "", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower())


def _latest_results(archive) -> dict | None:
    entries = [e for e in archive.entries() if e.lang == ARCHIVE_LANG and e.path.startswith("eidg/")]
    for e in sorted(entries, key=lambda e: e.path, reverse=True):
        payload = archive.load(ARCHIVE_LANG, e.path)
        try:
            if payload and payload["schweiz"]["vorlagen"][0]["kantone"]:
                return payload
        except (KeyError, IndexError, TypeError):
            continue
    return None


def municipality_index(payload) -> tuple[dict[str, set], dict[str, int]]:
    """Folded municipality name (also each part of 'Biel/Bienne' and without '(BE)') -> cantons; canton -> voters."""
    names: dict[str, set] = {}
    voters: dict[str, int] = {}
    for k in payload["schweiz"]["vorlagen"][0]["kantone"]:
        code = CANTONS.get(int(k["geoLevelnummer"]))
        if not code:
            continue
        voters[code] = int((k.get("resultat") or {}).get("anzahlStimmberechtigte") or 0)
        for g in k.get("gemeinden", []):
            full = g["geoLevelname"]
            base = re.sub(r"\s*\(.*\)$", "", full)
            for n in {full, base, *base.split("/")}:
                if _fold(n):
                    names.setdefault(_fold(n), set()).add(code)
    return names, voters


def donor_canton(city: str | None, country: str | None, lives_abroad, names: dict[str, set]) -> str | None:
    """Canton code, 'abroad', or None when the town cannot be placed with certainty."""
    if lives_abroad or (_fold(country) not in _SWISS):
        return "abroad"
    raw = re.sub(r"^\s*\d{4}\s*", "", city or "").strip()      # "8038 Zuerich"
    m = _SUFFIX.search(raw.replace(".", ""))                     # "Pfäffikon SZ", "Staufen AG"
    if m and " " in raw:
        return m.group(1)
    key = _fold(raw)
    hits = names.get(key)
    if hits and len(hits) == 1:
        return next(iter(hits))
    return _ALIASES.get(key)


def load_geo(conn, archive) -> dict:
    """Set donor.canton and canton_info.voters (migration 009); skips silently before it."""
    c = conn.cursor()
    c.execute("SHOW TABLES LIKE 'canton_info'")
    if c.fetchone() is None:
        return {}
    payload = _latest_results(archive)
    if payload is None:
        return {"note": "no BFS results archived yet"}
    names, voters = municipality_index(payload)
    c.execute("SELECT id, city, country, lives_abroad FROM donor")
    rows = [(donor_canton(city, country, abroad, names), did) for did, city, country, abroad in c.fetchall()]
    try:
        c.executemany("UPDATE donor SET canton=%s WHERE id=%s", rows)
        c.execute("DELETE FROM canton_info")
        c.executemany("INSERT INTO canton_info (canton, voters, as_of) VALUES (%s,%s,%s)",
                      [(k, v, payload.get("abstimmtag")) for k, v in voters.items() if v])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    placed = sum(1 for code, _ in rows if code and code != "abroad")
    return {"donors": len(rows), "placed": placed, "abroad": sum(1 for code, _ in rows if code == "abroad")}
