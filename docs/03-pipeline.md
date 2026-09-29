# 03 · Pipeline (scrape → archive → load)

Language: **Python 3.11+**. Dependencies are kept minimal: `httpx`, `PyMySQL`, `PyYAML`. Responses are validated by
hand-written strict parsers in `chpf/parse.py` (unknown shapes raise `ParseError`).

**Implemented choice (phase 1 spike):** the JSON detail endpoints are the only content source. The xlsx exports are
not used, because the JSON carries everything the model needs, including the candidate lists for elections. Details
are fetched in FR only, since amounts and names are language-neutral. Titles come from the FR/DE/IT trees.

## Stages

```
 ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
 │ discover │ → │  fetch   │ → │ raw archive  │ → │ normalise│ → │ resolve  │ → │  load   │
 │  trees   │   │ changed  │   │ files+sha256 │   │ + validate│  │ entities │   │ upsert  │
 └──────────┘   └──────────┘   └──────────────┘   └──────────┘   └──────────┘   └─────────┘
                                                                                     │
                                                                          checks + report/alert
```

1. **discover**: fetch the tree endpoints (`campaign_financings`, `party_financings`, `exports?group_by=votes|elections`,
   `actors?group_by=by_canton`) in fr/de/it. Build the list of (financing, actor, campaign, form) and allowance ids. Compare
   each tree's `data_checksum_sha256` with the last run. If nothing changed, stop: this is the normal case on most days.
2. **fetch**: fetch the detail JSON (`campaigns/{c}/forms/{f}`, fr) for declarations that are new, belong to a
   financing whose subtree changed, or are *recent* (vote or election within 400 days, or one of the last 2 party years).
   Recent ones are always refetched because amounts can be corrected without any change in the tree. Throttle, retry and set a User-Agent (see [01-data-sources.md](01-data-sources.md)).
3. **archive**: write each body to `data/raw/payloads/{lang}/{path}/{checksum}.json` and append a line to
   `data/raw/index.jsonl`. That index, not the DB, drives `rebuild`. The `raw_payload` table mirrors it. The archive is append-only, and its bodies are never edited.
4. **normalise**: parse the archived payloads into typed records (pydantic models). Parse CHF strings, dates, stance
   ("Adoption/Rejet" → for/against), phase (from the form label or id) and election columns. **Reject rather than guess:** an unknown
   form label or column fails the run for that financing, which is flagged in the report.
5. **resolve**:
   - actor → party (`config/parties.yaml` patterns, plus manual `config/actor_party.yaml`);
   - donor alias → donor (normalised key match, plus `config/donor_overrides.yaml`). New unmatched aliases create a new donor and
     are listed in the run report for review;
   - financing → BFS vote number (date + title similarity, plus `config/vote_numbers.yaml`).
6. **load**: rebuild the full snapshot from the archive and upsert everything in one transaction, using `efk_id` / upstream keys. Update `last_seen_run`, then delete
   rows of that financing that were not seen in this run (mirrors upstream removals).
7. **check**: run invariants and write a run report (markdown/JSON). Alert when a check fails:
   - Σ allowances ≤ declared monetary + non-monetary allowance totals, per declaration;
   - each vote financing has at least one campaign per stance once final data exists;
   - no declaration without an actor, and no negative amounts;
   - totals vs the previous run: a big drop (e.g. −30 %) is flagged, since it is more likely a parse error than a real change.

## Properties we want

- **Idempotent.** Running twice gives the same DB.
- **Rebuildable.** `pipeline rebuild --from-archive` recreates the DB with no network access. This is used for schema changes.
- **Incremental.** It only fetches what changed.
- **Observable.** `fetch_run` rows plus the report, and an email or push notification on failure or when new data arrives.

## Schedule

The EFK publishes budget declarations before votes (deadline 60 days before) and final accounts 60 days after.
New data therefore arrives in bursts around each vote date (4 per year) and in the party-year cycle (reports due by June 30).
A **daily** run at night is plenty: with checksums a no-change run is a handful of requests.
Optionally, run hourly for the two weeks after each deadline.

## CLI sketch

```
pipeline discover            # print what changed, fetch nothing
pipeline sync                # discover + fetch + load (cron entry point)
pipeline rebuild             # from archive only
pipeline resolve --review    # list unreviewed donor aliases / unmapped actors
pipeline check               # run invariants on the current DB
pipeline import-legacy       # one-off: compare with the old JSONs
```

## Where it runs

It runs on Infomaniak via cron if the plan allows Python (to verify, see [05-hosting-infomaniak.md](05-hosting-infomaniak.md)).
Otherwise it runs as a scheduled GitHub Action that connects to the DB remotely, or that uploads a SQL dump over SSH. The code
is identical in both cases; only the entry point differs.
