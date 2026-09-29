"""Load a parsed snapshot into MariaDB in one transaction.

Upserts on upstream keys (so surrogate ids used in site URLs stay stable), stamps
last_seen_run, then deletes rows that were not seen in this run (mirrors upstream removals).
Declarations that failed to fetch/parse are *kept* as they were (never deleted by accident).
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

import pymysql
import yaml

from . import settings
from .parse import Allowance, Declaration, Parties, donor_match_key


def connect():
    return pymysql.connect(**settings.db_params(), charset="utf8mb4", autocommit=False)


@dataclass
class Snapshot:
    financings: dict
    actors: dict
    campaigns: dict
    declarations: list                                   # parsed Declaration objects
    kept_forms: list = field(default_factory=list)       # FormRefs that failed: keep previous DB rows


class Loader:
    def __init__(self, conn, run_id: int, parties: Parties):
        self.c = conn.cursor()
        self.run = run_id
        self.parties = parties
        self.stats = Counter()
        self.new_donor_keys: list[str] = []

    def _upsert_id(self, sql: str, args) -> int:
        """sql must end with 'ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), …'."""
        self.c.execute(sql, args)
        return self.c.lastrowid

    def _label(self, entity: str, eid: int, fld: str, lang: str, text: str, official: bool = True) -> None:
        self.c.execute(
            "INSERT INTO i18n_label (entity, entity_id, field, lang, text, is_official) VALUES (%s,%s,%s,%s,%s,%s) "
            "ON DUPLICATE KEY UPDATE text=VALUES(text), is_official=VALUES(is_official)",
            (entity, eid, fld, lang, text, official))

    # ------------------------------------------------------------- steps

    def parties_(self) -> dict[str, int]:
        ids = {}
        for i, p in enumerate(self.parties.defs):
            pid = self._upsert_id(
                "INSERT INTO party (code, color, sort_order) VALUES (%s,%s,%s) "
                "ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), color=VALUES(color), sort_order=VALUES(sort_order)",
                (p.code, p.color, (i + 1) * 10))
            ids[p.code] = pid
            for lang, name in p.names.items():
                self._label("party", pid, "name", lang, name, official=False)
        return ids

    def financings_(self, snap: Snapshot) -> dict[tuple, int]:
        ids = {}
        has = {}
        for d in snap.declarations:
            has.setdefault(d.ref.financing_key, set()).add(d.phase)
        for key, f in snap.financings.items():
            phases = has.get(key, set())
            fid = self._upsert_id(
                "INSERT INTO financing (kind, efk_id, event_date, year, name, has_budget, has_final, first_seen_run, last_seen_run) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), "
                "event_date=VALUES(event_date), year=VALUES(year), name=VALUES(name), has_budget=VALUES(has_budget), "
                "has_final=VALUES(has_final), last_seen_run=VALUES(last_seen_run)",
                (f.kind, f.efk_id, f.event_date, f.year, f.name, "budget" in phases,
                 "final" in phases or "annual" in phases, self.run, self.run))
            ids[key] = fid
            for lang, title in f.titles.items():
                self._label("financing", fid, "title", lang, title)
            if f.kind == "vote":
                self.c.execute("INSERT INTO vote_object (financing_id, object_type) VALUES (%s,%s) "
                               "ON DUPLICATE KEY UPDATE object_type=VALUES(object_type)", (fid, f.object_type))
            elif f.kind == "election":
                self.c.execute("INSERT INTO election (financing_id, council, canton, is_by_election) VALUES (%s,%s,%s,%s) "
                               "ON DUPLICATE KEY UPDATE council=VALUES(council), canton=VALUES(canton), "
                               "is_by_election=VALUES(is_by_election)",
                               (fid, f.council, f.canton, f.canton is not None))
            self.stats["financings"] += 1
        return ids

    def actors_(self, snap: Snapshot, party_ids: dict) -> tuple[dict[int, int], dict[int, str | None]]:
        overrides = yaml.safe_load((settings.CONFIG_DIR / "actor_party.yaml").read_text()) or {}
        ids, actor_party = {}, {}
        for a in snap.actors.values():
            aid = self._upsert_id(
                "INSERT INTO actor (efk_id, name, city, canton, actor_type, first_seen_run, last_seen_run) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), name=VALUES(name), "
                "city=VALUES(city), canton=VALUES(canton), actor_type=VALUES(actor_type), last_seen_run=VALUES(last_seen_run)",
                (a.efk_id, a.name, a.city, a.canton, a.actor_type, self.run, self.run))
            ids[a.efk_id] = aid
            if a.efk_id in overrides:
                code, source = overrides[a.efk_id], "manual"
            else:
                code, source = self.parties.match(a.name), "heuristic"
            actor_party[a.efk_id] = code
            self.c.execute("DELETE FROM actor_party WHERE actor_id=%s", (aid,))
            if code:
                self.c.execute("INSERT INTO actor_party (actor_id, party_id, level, source) VALUES (%s,%s,%s,%s)",
                               (aid, party_ids[code], self.parties.level(a.name), source))
            self.stats["actors"] += 1
        return ids, actor_party

    def campaigns_(self, snap: Snapshot, fin_ids, actor_ids, actor_party, party_ids, candidates_by_campaign) -> dict[int, int]:
        ids = {}
        for cp in snap.campaigns.values():
            cands = candidates_by_campaign.get(cp.efk_id, [])
            codes = [self.parties.match(c.party_label) for c in cands]
            codes = [c for c in codes if c]
            party = Counter(codes).most_common(1)[0][0] if codes else actor_party.get(cp.actor_efk_id)
            cantons = [c.canton for c in cands if c.canton]
            canton = Counter(cantons).most_common(1)[0][0] if cantons else None
            cid = self._upsert_id(
                "INSERT INTO campaign (efk_id, financing_id, actor_id, stance, party_id, canton, name, first_seen_run, "
                "last_seen_run) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), "
                "financing_id=VALUES(financing_id), actor_id=VALUES(actor_id), stance=VALUES(stance), "
                "party_id=VALUES(party_id), canton=VALUES(canton), name=VALUES(name), last_seen_run=VALUES(last_seen_run)",
                (cp.efk_id, fin_ids[cp.financing_key], actor_ids[cp.actor_efk_id], cp.stance,
                 party_ids.get(party) if party else None, canton, cp.name, self.run, self.run))
            ids[cp.efk_id] = cid
            self.c.execute("DELETE FROM campaign_candidate WHERE campaign_id=%s", (cid,))
            for cand in cands:
                code = self.parties.match(cand.party_label)
                cand_id = self._upsert_id(
                    "INSERT INTO candidate (full_name, canton, party_label, party_id) VALUES (%s,%s,%s,%s) "
                    "ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), party_label=VALUES(party_label), party_id=VALUES(party_id)",
                    (cand.full_name, cand.canton, cand.party_label, party_ids.get(code) if code else None))
                self.c.execute("INSERT IGNORE INTO campaign_candidate VALUES (%s,%s)", (cid, cand_id))
            self.stats["campaigns"] += 1
        return ids

    def _donor_alias(self, a: Allowance, cache: dict, overrides: dict) -> int | None:
        key = donor_match_key(a)
        if key is None:
            return None
        if key in cache:
            return cache[key]
        target = overrides.get(key)
        donor_id = None
        if target and target in cache:
            self.c.execute("SELECT donor_id FROM donor_alias WHERE id=%s", (cache[target],))
            donor_id = self.c.fetchone()[0]
        if donor_id is None:
            display = a.name if a.donor_type == "legal" else " ".join(x for x in (a.name, a.first_name) if x)
            self.c.execute("INSERT INTO donor (donor_type, display_name, city, lives_abroad, country) "
                           "VALUES (%s,%s,%s,%s,%s)", (a.donor_type, display, a.city, a.lives_abroad, a.country))
            donor_id = self.c.lastrowid
            self.new_donor_keys.append(key)
        self.c.execute("INSERT INTO donor_alias (match_key, raw_name, raw_first_name, raw_city, donor_id, link_source) "
                       "VALUES (%s,%s,%s,%s,%s,%s)",
                       (key, a.name, a.first_name, a.city, donor_id, "manual" if target else "auto"))
        cache[key] = self.c.lastrowid
        return cache[key]

    def declarations_(self, snap: Snapshot, fin_ids, actor_ids, camp_ids) -> None:
        overrides = yaml.safe_load((settings.CONFIG_DIR / "donor_overrides.yaml").read_text()) or {}
        self.c.execute("SELECT match_key, id FROM donor_alias")
        alias_cache = dict(self.c.fetchall())
        for d in snap.declarations:
            r = d.ref
            did = self._upsert_id(
                "INSERT INTO declaration (campaign_id, financing_id, actor_id, efk_form_id, efk_campaign_id, phase, kind, "
                "source_checksum, first_seen_run, last_seen_run) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), campaign_id=VALUES(campaign_id), "
                "financing_id=VALUES(financing_id), actor_id=VALUES(actor_id), phase=VALUES(phase), kind=VALUES(kind), "
                "source_checksum=VALUES(source_checksum), last_seen_run=VALUES(last_seen_run)",
                (camp_ids.get(r.campaign_efk_id) if r.in_campaign_table else None, fin_ids[r.financing_key],
                 actor_ids[r.actor_efk_id], r.form_efk_id, r.campaign_efk_id, d.phase, d.kind, d.checksum,
                 self.run, self.run))
            self.stats["declarations"] += 1
            if d.totals is not None:
                t = d.totals
                self.c.execute(
                    "REPLACE INTO declaration_totals (declaration_id, total, monetary_allowances, non_monetary_allowances, "
                    "events, sales, equity, membership_fees, mandate_contributions) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (did, t["total"], t.get("monetary_allowances", 0), t.get("non_monetary_allowances", 0),
                     t.get("events", 0), t.get("sales", 0), t.get("equity"), t.get("membership_fees"),
                     t.get("mandate_contributions")))
            self.c.execute("DELETE FROM mandate_contribution WHERE declaration_id=%s", (did,))
            if d.contributions:
                self.c.executemany(
                    "INSERT INTO mandate_contribution (declaration_id, last_name, first_name, institution, amount_chf) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    [(did, m.last_name, m.first_name, m.institution, m.amount) for m in d.contributions])
            rows = []
            for a in d.allowances:
                alias_id = self._donor_alias(a, alias_cache, overrides)
                rows.append((did, alias_id, a.nature, a.service_type, a.description, a.value, a.granted_on,
                             a.is_anonymous, a.is_foreign, a.country, a.row_hash, self.run, self.run))
            if rows:
                self.c.executemany(
                    "INSERT INTO allowance (declaration_id, donor_alias_id, nature, service_type, description, value_chf, "
                    "granted_on, is_anonymous, is_foreign, country, row_hash, first_seen_run, last_seen_run) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE "
                    "donor_alias_id=VALUES(donor_alias_id), last_seen_run=VALUES(last_seen_run)", rows)
                self.stats["allowances"] += len(rows)

    def keep_(self, snap: Snapshot) -> None:
        for r in snap.kept_forms:
            self.c.execute("UPDATE declaration SET last_seen_run=%s WHERE efk_campaign_id=%s AND efk_form_id=%s",
                           (self.run, r.campaign_efk_id, r.form_efk_id))
            self.c.execute("UPDATE allowance a JOIN declaration d ON d.id=a.declaration_id SET a.last_seen_run=%s "
                           "WHERE d.efk_campaign_id=%s AND d.efk_form_id=%s", (self.run, r.campaign_efk_id, r.form_efk_id))

    def prune_(self) -> None:
        for table in ("allowance", "declaration", "campaign", "financing", "actor"):
            n = self.c.execute(f"DELETE FROM {table} WHERE last_seen_run IS NULL OR last_seen_run < %s", (self.run,))
            if n:
                self.stats[f"deleted_{table}"] += n
        self.c.execute("DELETE al FROM donor_alias al LEFT JOIN allowance a ON a.donor_alias_id=al.id WHERE a.id IS NULL")
        self.c.execute("DELETE dn FROM donor dn LEFT JOIN donor_alias al ON al.donor_id=dn.id WHERE al.id IS NULL")
        self.c.execute("DELETE cd FROM candidate cd LEFT JOIN campaign_candidate cc ON cc.candidate_id=cd.id "
                       "WHERE cc.campaign_id IS NULL")
        self.c.execute("DELETE FROM i18n_label WHERE entity='financing' AND entity_id NOT IN (SELECT id FROM financing)")


def load_snapshot(conn, run_id: int, snap: Snapshot, parties: Parties, candidates_by_campaign: dict) -> Loader:
    ld = Loader(conn, run_id, parties)
    try:
        party_ids = ld.parties_()
        fin_ids = ld.financings_(snap)
        actor_ids, actor_party = ld.actors_(snap, party_ids)
        camp_ids = ld.campaigns_(snap, fin_ids, actor_ids, actor_party, party_ids, candidates_by_campaign)
        ld.declarations_(snap, fin_ids, actor_ids, camp_ids)
        ld.keep_(snap)
        ld.prune_()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return ld
