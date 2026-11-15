"""Lobbywatch (https://lobbywatch.ch, CC BY-SA 4.0): current members of the Federal Assembly, their declared ties and
the organisations concerned. See docs/01-data-sources.md › F.

Source: the weekly public "flat" CSV export (one zip, ~4 MB, tab-separated). Fetched on every sync with a conditional
request and archived only when it changed; older archived versions are pruned (only current data is openly licensed).
The zip is read in memory, member by member; nothing is extracted to disk.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date

import httpx

from . import settings
from .parse import ParseError, Parties, fold

URL = "https://cms.lobbywatch.ch/sites/lobbywatch.ch/files/exports/lobbywatch_export_flat.csv.zip"
ARCHIVE_LANG, ARCHIVE_PATH = "lw", "lobbywatch_export_flat"
MAX_ZIP_BYTES = 60 * 1024 * 1024          # the export is ~4 MB; refuse anything absurd
MAX_MEMBER_BYTES = 80 * 1024 * 1024
KEEP_VERSIONS = 4

MEMBERS = {
    "parlamentarier": {"id", "nachname", "vorname", "vorname_kurz", "parlament_biografie_id", "kanton", "rat", "partei", "partei_name", "im_rat_seit"},
    "interessenbindung": {"id", "parlamentarier_id", "organisation_id", "art", "funktion_im_gremium", "beschreibung",
                          "beschreibung_fr", "deklarationstyp", "hauptberuflich", "von", "bis"},
    "interessenbindung_jahr": {"interessenbindung_id", "jahr", "verguetung"},
    "organisation": {"id", "name_de", "name_fr", "name_it", "ort", "rechtsform", "interessengruppe_id", "abkuerzung_de",
                     "abkuerzung_fr"},
    "interessengruppe": {"id", "name", "name_fr"},
}


@dataclass
class Parliamentarian:
    id: int
    last_name: str
    first_name: str
    canton: str | None
    council: str | None
    party_label: str | None
    party_code: str | None
    since: date | None
    short_first_name: str | None = None
    person_number: int | None = None      # Parliament's person number (parlament_biografie_id)


@dataclass
class Organisation:
    id: int
    name_de: str
    name_fr: str | None
    name_it: str | None
    city: str | None
    legal_form: str | None
    lobby_group_de: str | None
    lobby_group_fr: str | None
    abbreviations: list = field(default_factory=list)


@dataclass
class Tie:
    id: int
    parliamentarian_id: int
    organisation_id: int
    kind: str
    role: str | None
    description_de: str | None
    description_fr: str | None
    must_declare: bool
    main_job: bool
    since: date | None
    pay_year: int | None = None
    pay: int | None = None


@dataclass
class Export:
    exported_at: str | None
    parliamentarians: list
    organisations: list
    ties: list


def fetch(client: httpx.Client | None = None, validators=None, have_copy: bool = False) -> tuple[bytes, str] | None:
    """The export, or None when it has not changed since our copy (conditional request)."""
    own = client is None
    client = client or httpx.Client(headers={"User-Agent": settings.USER_AGENT}, timeout=120, follow_redirects=True)
    try:
        r = client.get(URL, headers=validators.headers("lobbywatch", have_copy) if validators else None)
        if r.status_code == 304:
            return None
        r.raise_for_status()
        if validators:
            validators.remember("lobbywatch", r)
    finally:
        if own:
            client.close()
    body = r.content
    if len(body) > MAX_ZIP_BYTES or not body.startswith(b"PK"):
        raise ParseError("lobbywatch: not a zip of the expected size")
    return body, hashlib.sha256(body).hexdigest()


def _rows(zf: zipfile.ZipFile, table: str) -> list[dict]:
    names = [n for n in zf.namelist() if n.rsplit("/", 1)[-1] == f"flat_{table}.csv"]
    if len(names) != 1:
        raise ParseError(f"lobbywatch: flat_{table}.csv missing")
    info = zf.getinfo(names[0])
    if info.file_size > MAX_MEMBER_BYTES:
        raise ParseError(f"lobbywatch: flat_{table}.csv too large")
    text = zf.read(info).decode("utf-8-sig")
    csv.field_size_limit(MAX_MEMBER_BYTES)
    reader = csv.DictReader(io.StringIO(text, newline=""), delimiter="\t")
    missing = MEMBERS[table] - set(reader.fieldnames or [])
    if missing:
        raise ParseError(f"lobbywatch: flat_{table}.csv lacks {sorted(missing)}")
    return list(reader)


def _date(v: str | None) -> date | None:
    v = (v or "").strip()[:10]
    try:
        return date.fromisoformat(v) if v else None
    except ValueError:
        return None


def _s(v: str | None, n: int) -> str | None:
    v = re.sub(r"\s+", " ", v or "").strip()
    return v[:n] or None


def parse(body: bytes, parties: Parties) -> Export:
    """Current members, their current ties (no end date), the organisations those ties point to."""
    with zipfile.ZipFile(io.BytesIO(body)) as zf:
        parl, ties, years, orgs, groups = (_rows(zf, t) for t in
                                           ("parlamentarier", "interessenbindung", "interessenbindung_jahr",
                                            "organisation", "interessengruppe"))
        exported = None
        for n in zf.namelist():
            if n.endswith("flat_parlamentarier.csv.md"):
                m = re.search(rb"Datum:\s*([0-9.]+ [0-9:]+)", zf.read(n)[:2000])
                exported = m.group(1).decode() if m else None

    people = [Parliamentarian(int(p["id"]), p["nachname"].strip(), p["vorname"].strip(), _s(p["kanton"], 2),
                              p["rat"] if p["rat"] in ("NR", "SR") else None, _s(p["partei"], 40),
                              parties.match(p["partei_name"]) or parties.match(p["partei"]), _date(p["im_rat_seit"]),
                              _s(p["vorname_kurz"], 120),
                              int(p["parlament_biografie_id"]) if p["parlament_biografie_id"].isdigit() else None)
              for p in parl if p["id"].isdigit()]
    ids = {p.id for p in people}

    pay = {}
    for y in years:
        if not (y["interessenbindung_id"].isdigit() and y["jahr"].isdigit()):
            continue
        try:
            amount = int(float(y["verguetung"]))
        except ValueError:
            continue
        key, year = int(y["interessenbindung_id"]), int(y["jahr"])
        if key not in pay or year > pay[key][0]:
            pay[key] = (year, amount)

    tie_list = []
    for t in ties:
        if (t["bis"] or "").strip() or not (t["id"].isdigit() and t["organisation_id"].isdigit()
                                           and t["parlamentarier_id"].isdigit()):
            continue
        if int(t["parlamentarier_id"]) not in ids:
            continue
        year, amount = pay.get(int(t["id"]), (None, None))
        tie_list.append(Tie(int(t["id"]), int(t["parlamentarier_id"]), int(t["organisation_id"]), t["art"].strip() or "mitglied",
                            _s(t["funktion_im_gremium"], 40), _s(t["beschreibung"], 500), _s(t["beschreibung_fr"], 500),
                            t["deklarationstyp"] != "nicht deklarationspflicht", t["hauptberuflich"] == "1",
                            _date(t["von"]), year, amount))

    used = {t.organisation_id for t in tie_list}
    group = {g["id"]: (_s(g["name"], 200), _s(g["name_fr"], 200)) for g in groups}
    org_list = []
    for o in orgs:
        if not o["id"].isdigit() or int(o["id"]) not in used:
            continue
        g = group.get(o["interessengruppe_id"], (None, None))
        org_list.append(Organisation(int(o["id"]), _s(o["name_de"], 500) or f"#{o['id']}", _s(o["name_fr"], 500),
                                     _s(o["name_it"], 500), _s(o["ort"], 200), _s(o["rechtsform"], 60), g[0], g[1],
                                     [a for a in (_s(o["abkuerzung_de"], 40), _s(o["abkuerzung_fr"], 40)) if a]))
    known = {o.id for o in org_list}
    tie_list = [t for t in tie_list if t.organisation_id in known]
    return Export(exported, people, org_list, tie_list)


# ----------------------------------------------------------------- matching

_LEGAL = r"\b(ag|sa|gmbh|sarl|sagl|kg|se|ltd|inc|genossenschaft|cooperative|stiftung|fondation|fondazione|verein|association)\b"


def org_key(name: str | None) -> str:
    """'Société Suisse des Entrepreneurs (SSE)' / 'Automobil Club der Schweiz, ACS' -> comparable letters only."""
    t = fold(name or "")
    t = re.sub(r"\([^()]*\)", " ", t)                 # "(SSE)"
    t = re.sub(r",\s*[a-z0-9.&-]{2,12}\s*$", " ", t)   # trailing ", ACS"
    t = re.sub(_LEGAL, " ", t)
    return re.sub(r"[^a-z0-9]", "", t)


def person_key(name: str, canton: str | None) -> tuple[str, str | None]:
    return re.sub(r"[^a-z]", "", fold(name)), canton


def match_parliamentarians(people: list, candidates: list[tuple[int, str, str | None]]) -> dict[int, list[int]]:
    """Lobbywatch member id -> EFK candidate ids. Same letters and canton, last-first or first-last, with the full or
    the short first name; all exact hits are kept (the EFK may list one person under two spellings). Otherwise a
    unique candidate in that canton whose name starts with those letters (EFK names may carry middle names)."""
    exact, by_canton = {}, {}
    for cid, name, canton in candidates:
        exact.setdefault(person_key(name, canton), []).append(cid)
        by_canton.setdefault(canton, []).append((person_key(name, canton)[0], cid))
    out = {}
    for p in people:
        firsts = [f for f in (p.first_name, p.short_first_name) if f]
        keys = [person_key(n, p.canton) for f in firsts for n in (f"{p.last_name} {f}", f"{f} {p.last_name}")]
        hits = sorted({cid for k in keys for cid in exact.get(k, [])})
        if not hits:
            prefix = sorted({cid for letters, cid in by_canton.get(p.canton, []) for k in keys if letters.startswith(k[0])})
            hits = prefix if len(prefix) == 1 else []
        if hits:
            out[p.id] = hits
    return out


def match_organisations(orgs: list, entities: list[tuple[int, str]]) -> dict[int, int]:
    """Lobbywatch organisation id -> entity id (EFK actor or donor), on identical normalised names only, and only when
    the name is unambiguous on both sides."""
    by_key = {}
    for eid, name in entities:
        k = org_key(name)
        if len(k) >= 4:
            by_key.setdefault(k, set()).add(eid)
    org_keys = {}
    for o in orgs:
        for name in {o.name_de, o.name_fr, o.name_it} - {None}:
            k = org_key(name)
            if len(k) >= 4:
                org_keys.setdefault(k, set()).add(o.id)
    out = {}
    for k, eids in by_key.items():
        oids = org_keys.get(k, set())
        if len(eids) == 1 and len(oids) == 1:
            out[next(iter(oids))] = next(iter(eids))
    return out


# ----------------------------------------------------------------- database

def load(conn, export: Export, overrides: dict) -> dict:
    """Replace the Lobbywatch tables with this export (one transaction). Returns counts for the run report.
    Skips silently (returns {}) when migration 004 has not been applied yet."""
    c = conn.cursor()
    c.execute("SHOW TABLES LIKE 'lw_tie'")
    if c.fetchone() is None:
        return {}
    c.execute("SELECT code, id FROM party")
    party_ids = dict(c.fetchall())
    c.execute("SELECT id, full_name, canton FROM candidate")
    cand = match_parliamentarians(export.parliamentarians, c.fetchall())
    c.execute("SELECT id, name, efk_id FROM actor")
    actors = c.fetchall()
    actor_match = match_organisations(export.organisations, [(a[0], a[1]) for a in actors])
    c.execute("SELECT id, display_name FROM donor WHERE donor_type = 'legal'")
    donor_match = match_organisations(export.organisations, c.fetchall())

    # Manual corrections (config/lobbywatch_matches.yaml): add links by EFK actor id, or drop wrong automatic ones.
    by_efk = {a[2]: a[0] for a in actors}
    manual = {int(k): by_efk[int(v)] for k, v in (overrides.get("actors") or {}).items() if int(v) in by_efk}
    for oid in overrides.get("not_matched") or []:
        actor_match.pop(int(oid), None)
        donor_match.pop(int(oid), None)
    actor_match.update(manual)

    try:
        for table in ("lw_tie", "lw_candidate", "lw_organisation", "lw_parliamentarian", "lw_meta"):
            c.execute(f"DELETE FROM {table}")
        c.executemany(
            "INSERT INTO lw_parliamentarian (id, last_name, first_name, canton, council, party_label, party_id, "
            "in_council_since) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            [(p.id, p.last_name, p.first_name, p.canton, p.council, p.party_label,
              party_ids.get(p.party_code) if p.party_code else None, p.since) for p in export.parliamentarians])
        c.execute("SHOW COLUMNS FROM lw_parliamentarian LIKE 'parl_person_number'")      # migration 006
        if c.fetchone() is not None:
            c.executemany("UPDATE lw_parliamentarian SET parl_person_number=%s WHERE id=%s",
                          [(p.person_number, p.id) for p in export.parliamentarians if p.person_number])
        c.executemany("INSERT IGNORE INTO lw_candidate (candidate_id, parliamentarian_id) VALUES (%s,%s)",
                      [(cid, pid) for pid, cids in cand.items() for cid in cids])
        c.executemany(
            "INSERT INTO lw_organisation (id, name_de, name_fr, name_it, city, legal_form, lobby_group_de, lobby_group_fr, "
            "actor_id, donor_id, match_source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            [(o.id, o.name_de, o.name_fr, o.name_it, o.city, o.legal_form, o.lobby_group_de, o.lobby_group_fr,
              actor_match.get(o.id), donor_match.get(o.id),
              "manual" if o.id in manual else ("auto" if o.id in actor_match or o.id in donor_match else None))
             for o in export.organisations])
        c.executemany(
            "INSERT INTO lw_tie (id, parliamentarian_id, organisation_id, kind, role, description_de, description_fr, "
            "must_declare, main_job, since, pay_year, pay) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            [(t.id, t.parliamentarian_id, t.organisation_id, t.kind[:30], t.role, t.description_de, t.description_fr,
              t.must_declare, t.main_job, t.since, t.pay_year, t.pay) for t in export.ties])
        c.execute("INSERT INTO lw_meta (k, v) VALUES ('exported_at', %s)", (export.exported_at or "",))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"members": len(export.parliamentarians), "members_matched": len(cand), "ties": len(export.ties),
            "organisations": len(export.organisations), "actors_matched": len(actor_match),
            "donors_matched": len(donor_match)}
