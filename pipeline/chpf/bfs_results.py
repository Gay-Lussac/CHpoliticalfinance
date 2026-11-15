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
            rows += [(ids[b.anr], r["canton"], r["yes_share"], r["yes"], r["no"], r["turnout"], r["provisional"])
                     for r in canton_results(archive, b.vote_date, b.anr)]
    try:
        c.execute("DELETE FROM ballot_canton")
        c.executemany("INSERT INTO ballot_canton (ballot_id, canton, yes_share, yes, no, turnout, provisional) "
                      "VALUES (%s,%s,%s,%s,%s,%s,%s)", rows)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"rows": len(rows), "ballots": len({r[0] for r in rows})}
