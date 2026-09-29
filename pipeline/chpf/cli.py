"""pipeline CLI – see docs/03-pipeline.md.

  pipeline discover            fetch the trees only and print what would be fetched
  pipeline sync [--full]       discover + fetch changed details + load + check   (cron entry point)
  pipeline rebuild             load the DB from the raw archive only (no network)
  pipeline check               run the invariant checks on the current DB
  pipeline resolve --review    list possible duplicate donors to merge in config/donor_overrides.yaml
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta

from . import settings
from .archive import Archive
from .efk import EfkClient, EfkError
from .load import Snapshot, connect, load_snapshot
from .parse import Cantons, Parties, ParseError, classify_form, parse_candidates, parse_detail, parse_trees

TREES = ["campaign_financings", "party_financings"]
CANTON_TREE = "actors?group_by=by_canton"
RECENT_DAYS = 400


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


# ----------------------------------------------------------------- fetching

def fetch_trees(client: EfkClient, archive: Archive) -> list[str]:
    changed = []
    for lang in settings.LANGS:
        for path in TREES:
            payload, checksum, body = client.get_json(lang, path)
            _, is_new = archive.store(lang, path, checksum, body)
            if is_new:
                changed.append(f"{lang}/{path}")
    payload, checksum, body = client.get_json("fr", CANTON_TREE)
    archive.store("fr", CANTON_TREE, checksum, body)
    return changed


def _subtree_hashes(archive: Archive) -> dict[str, str]:
    out = {}
    for path, kind in (("campaign_financings", "campaign"), ("party_financings", "party_year")):
        tree = archive.load("fr", path) or {"data": {"tree_roots": []}}
        for node in tree["data"]["tree_roots"]:
            out[f"{kind}:{node['id']}"] = hashlib.sha256(json.dumps(node, sort_keys=True).encode()).hexdigest()
    return out


def select_details(archive: Archive, forms, financings, full: bool) -> list:
    state_file = settings.RAW_DIR / "state.json"
    old = json.loads(state_file.read_text()) if state_file.exists() else {}
    new = _subtree_hashes(archive)
    today = date.today()
    wanted = []
    for ref in forms:
        f = financings[ref.financing_key]
        skey = f"{'party_year' if f.kind == 'party_year' else 'campaign'}:{f.efk_id}"
        recent = (f.event_date and f.event_date >= today - timedelta(days=RECENT_DAYS)) or \
                 (f.kind == "party_year" and f.year >= today.year - 1)
        if full or recent or archive.latest("fr", ref.detail_path) is None or old.get(skey) != new.get(skey):
            wanted.append(ref)
    return wanted, (state_file, new)


def fetch_details(client: EfkClient, archive: Archive, refs) -> tuple[int, list[str]]:
    changed, errors = 0, []
    for i, ref in enumerate(refs, 1):
        try:
            payload, checksum, body = client.get_json("fr", ref.detail_path)
            _, is_new = archive.store("fr", ref.detail_path, checksum, body)
            changed += is_new
        except EfkError as e:
            errors.append(str(e))
        if i % 100 == 0:
            log(f"  details {i}/{len(refs)} ({changed} changed)")
    return changed, errors


# ----------------------------------------------------------------- building the snapshot

def build_snapshot(archive: Archive, cantons: Cantons):
    cf = archive.load("fr", "campaign_financings")
    pf = archive.load("fr", "party_financings")
    if not cf or not pf:
        raise SystemExit("raw archive is empty – run `pipeline sync` first")
    titles = {}
    for lang in settings.LANGS:
        t = archive.load(lang, "campaign_financings")
        if t:
            titles[lang] = {n["id"]: n["label"] for n in t["data"]["tree_roots"]}
    financings, actors, campaigns, forms = parse_trees(cf, pf, titles, archive.load("fr", CANTON_TREE), cantons)

    siblings = defaultdict(list)
    for ref in forms:
        siblings[(ref.financing_key, ref.campaign_efk_id)].append(ref.label)

    declarations, kept, errors = [], [], []
    candidates_by_campaign = {}
    for ref in forms:
        entry = archive.latest("fr", ref.detail_path)
        if entry is None:
            kept.append(ref)
            errors.append(f"{ref.detail_path}: not fetched yet")
            continue
        try:
            phase, kind = classify_form(ref, siblings[(ref.financing_key, ref.campaign_efk_id)])
            decl = parse_detail(ref, phase, kind, archive.load("fr", ref.detail_path), entry.checksum)
        except ParseError as e:
            kept.append(ref)
            errors.append(str(e))
            continue
        declarations.append(decl)
        if kind == "totals" and ref.in_campaign_table and campaigns[ref.campaign_efk_id].stance == "candidates":
            cands = parse_candidates(decl.campaign_label, cantons)
            if cands and len(cands) >= len(candidates_by_campaign.get(ref.campaign_efk_id, [])):
                candidates_by_campaign[ref.campaign_efk_id] = cands
    return Snapshot(financings, actors, campaigns, declarations, kept), forms, candidates_by_campaign, errors


# ----------------------------------------------------------------- checks

CHECKS = [
    ("allowances exceed declared allowance totals (same campaign & phase, > CHF 1)",
     """SELECT f.name, a.name, d.phase, SUM(al.value_chf) AS listed,
               (SELECT SUM(t.monetary_allowances + t.non_monetary_allowances) FROM declaration d2
                  JOIN declaration_totals t ON t.declaration_id = d2.id
                 WHERE d2.efk_campaign_id = d.efk_campaign_id AND d2.phase = d.phase) AS declared
          FROM allowance al JOIN declaration d ON d.id = al.declaration_id
          JOIN financing f ON f.id = d.financing_id JOIN actor a ON a.id = d.actor_id
         GROUP BY d.efk_campaign_id, d.phase HAVING declared IS NOT NULL AND listed > declared + 1"""),
    ("negative amounts",
     "SELECT 'allowance', id, value_chf FROM allowance WHERE value_chf < 0 "
     "UNION ALL SELECT 'totals', declaration_id, total FROM declaration_totals WHERE total < 0"),
    ("votes with final accounts but only one side",
     """SELECT f.name FROM financing f JOIN campaign c ON c.financing_id = f.id
         WHERE f.kind = 'vote' AND f.has_final GROUP BY f.id HAVING COUNT(DISTINCT c.stance) < 2"""),
]


def run_checks(conn) -> list[tuple[str, list]]:
    out = []
    with conn.cursor() as c:
        for title, sql in CHECKS:
            c.execute(sql)
            out.append((title, list(c.fetchall())))
    return out


# ----------------------------------------------------------------- run bookkeeping

def start_run(conn, trigger: str) -> int:
    with conn.cursor() as c:
        c.execute("INSERT INTO fetch_run (started_at, trigger_kind) VALUES (NOW(), %s)", (trigger,))
        conn.commit()
        return c.lastrowid


def finish_run(conn, run_id: int, status: str, notes: str) -> None:
    with conn.cursor() as c:
        c.execute("UPDATE fetch_run SET finished_at=NOW(), status=%s, notes=%s WHERE id=%s", (status, notes[:60000], run_id))
    conn.commit()


def record_payloads(conn, run_id: int, archive: Archive) -> None:
    rows = [(run_id, f"{e.lang}/{e.path}", e.lang, e.checksum, "application/json", e.file,
             e.fetched_at[:19].replace("T", " "), e.fetched_at[:19].replace("T", " ")) for e in archive.entries()]
    with conn.cursor() as c:
        c.executemany(
            "INSERT INTO raw_payload (fetch_run_id, url, lang, checksum, content_type, archive_path, fetched_at, last_fetched_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE last_fetched_at=VALUES(last_fetched_at)", rows)
    conn.commit()


def write_report(run_id: int, lines: list[str]) -> str:
    settings.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = settings.REPORT_DIR / f"run-{run_id:05d}.md"
    path.write_text("\n".join(lines) + "\n")
    return str(path)


# ----------------------------------------------------------------- commands

def cmd_load(trigger: str, full: bool, fetch: bool) -> int:
    archive, cantons, parties = Archive(), Cantons(), Parties()
    conn = connect()
    run_id = start_run(conn, trigger)
    report = [f"# Run {run_id} ({trigger}) – {datetime.now():%Y-%m-%d %H:%M}", ""]
    status = "ok"
    try:
        fetch_errors = []
        if fetch:
            client = EfkClient()
            log("fetching trees (fr/de/it)")
            changed_trees = fetch_trees(client, archive)
            report.append(f"- changed trees: {', '.join(changed_trees) or 'none'}")
            snap, forms, _, _ = build_snapshot(archive, cantons)
            refs, (state_file, new_state) = select_details(archive, forms, snap.financings, full)
            log(f"fetching {len(refs)} of {len(forms)} declaration details")
            n_changed, fetch_errors = fetch_details(client, archive, refs)
            state_file.write_text(json.dumps(new_state, indent=0))
            report.append(f"- details fetched: {len(refs)} ({n_changed} new/changed), requests: {client.request_count}")
            client.close()
        log("parsing archive")
        snap, forms, cands, parse_errors = build_snapshot(archive, cantons)
        log(f"loading {len(snap.financings)} financings, {len(snap.declarations)} declarations")
        ld = load_snapshot(conn, run_id, snap, parties, cands)
        record_payloads(conn, run_id, archive)
        report += ["", "## Loaded", *[f"- {k}: {v}" for k, v in sorted(ld.stats.items())],
                   f"- new donors: {len(ld.new_donor_keys)}"]
        errors = fetch_errors + parse_errors
        if errors:
            status = "partial"
            report += ["", f"## Errors ({len(errors)}) – previous data kept for these declarations",
                       *[f"- {e}" for e in errors[:200]]]
        report += ["", "## Checks"]
        for title, rows in run_checks(conn):
            report.append(f"- {'OK' if not rows else 'WARN'} {title}: {len(rows)}")
            report += [f"  - {r}" for r in rows[:15]]
    except Exception as e:
        status = "failed"
        report += ["", f"## FAILED: {e!r}"]
        finish_run(conn, run_id, status, "\n".join(report))
        write_report(run_id, report)
        raise
    finish_run(conn, run_id, status, "\n".join(report))
    path = write_report(run_id, report)
    log(f"run {run_id}: {status} – report: {path}")
    print("\n".join(report))
    return 0 if status != "failed" else 1


def cmd_discover() -> int:
    archive, cantons = Archive(), Cantons()
    client = EfkClient()
    changed = fetch_trees(client, archive)
    snap, forms, _, _ = build_snapshot(archive, cantons)
    refs, _ = select_details(archive, forms, snap.financings, full=False)
    by_kind = defaultdict(int)
    for f in snap.financings.values():
        by_kind[f.kind] += 1
    print(f"changed trees: {changed or 'none'}")
    print(f"financings: {dict(by_kind)}, actors: {len(snap.actors)}, campaigns: {len(snap.campaigns)}, forms: {len(forms)}")
    print(f"a sync would fetch {len(refs)} declaration details")
    return 0


def cmd_check() -> int:
    conn = connect()
    bad = 0
    for title, rows in run_checks(conn):
        print(f"{'OK  ' if not rows else 'WARN'} {title}: {len(rows)}")
        for r in rows[:20]:
            print("     ", r)
        bad += bool(rows)
    return 0


def cmd_review() -> int:
    """Natural persons with the same name+first name in several cities, and legal names equal after
    dropping legal-form suffixes – candidates for config/donor_overrides.yaml."""
    import re
    conn = connect()
    with conn.cursor() as c:
        c.execute("SELECT al.match_key, dn.display_name, dn.city, COUNT(a.id), SUM(a.value_chf) FROM donor_alias al "
                  "JOIN donor dn ON dn.id = al.donor_id LEFT JOIN allowance a ON a.donor_alias_id = al.id "
                  "GROUP BY al.id ORDER BY al.match_key")
        rows = c.fetchall()
    groups = defaultdict(list)
    for key, name, city, n, total in rows:
        parts = key.split("|")
        if parts[0] == "natural":
            g = "natural|" + parts[1] + "|" + parts[2]
        else:
            g = "legal|" + re.sub(r"\b(ag|sa|gmbh|sarl|sagl|ltd|inc|verein|association|stiftung|fondation|genossenschaft)\b", "",
                                  parts[1]).strip()
        groups[g].append((key, name, city, n, total))
    n = 0
    for g, members in sorted(groups.items()):
        if len(members) > 1:
            n += 1
            print(f"\n{g}")
            for key, name, city, cnt, total in members:
                print(f"   {key!r:60}  {name} ({city}) – {cnt} allowances, CHF {total}")
    print(f"\n{n} possible duplicate groups. To merge, add  \"<alias key>\": \"<target key>\"  to config/donor_overrides.yaml,"
          " then run `pipeline rebuild`.")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="pipeline", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sync")
    s.add_argument("--full", action="store_true", help="refetch every declaration detail")
    s.add_argument("--trigger", default="manual", choices=["cron", "manual", "backfill"])
    sub.add_parser("rebuild")
    sub.add_parser("discover")
    sub.add_parser("check")
    r = sub.add_parser("resolve")
    r.add_argument("--review", action="store_true", required=True)
    a = p.parse_args(argv)
    if a.cmd == "sync":
        return cmd_load(a.trigger, a.full, fetch=True)
    if a.cmd == "rebuild":
        return cmd_load("backfill", False, fetch=False)
    if a.cmd == "discover":
        return cmd_discover()
    if a.cmd == "check":
        return cmd_check()
    return cmd_review()


if __name__ == "__main__":
    sys.exit(main())
