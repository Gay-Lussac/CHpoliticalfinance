# 03 · Pipeline (scrape → archive → load)

Language: **Python 3.11+**, the same as the legacy work. Dependencies: `httpx`, `pydantic` (response validation),
`openpyxl`, `SQLAlchemy Core` + `PyMySQL`, `PyYAML`. No pandas is needed in production.

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
   `allowances?group_by=by_amount`) in `fr`. Build the list of (financing, actor, campaign, form) and allowance ids. Compare
   each tree's `data_checksum_sha256` with the last run. If nothing changed, stop: this is the normal case on most days.
2. **fetch**: for new or changed nodes, fetch the detail JSON (`campaigns/{c}/forms/{f}`) in fr/de/it, plus the bulk
   xlsx per changed financing (budget and final). Throttle, retry and set a User-Agent (see [01-data-sources.md](01-data-sources.md)).
3. **archive**: write each body to `data/raw/{yyyy-mm-dd}/{endpoint-path}.{lang}.json|xlsx` and record a `raw_payload` row
   (url, checksum, path). The archive is append-only, and its bodies are never edited.
4. **normalise**: parse the archived payloads into typed records (pydantic models). Parse CHF strings, dates, stance
   ("Adoption/Rejet" → for/against), phase (from the form label or id) and election columns. **Reject rather than guess:** an unknown
   form label or column fails the run for that financing, which is flagged in the report.
5. **resolve**:
   - actor → party (`config/parties.yaml` patterns, plus manual `config/actor_party.yaml`);
   - donor alias → donor (normalised key match, plus `config/donor_overrides.yaml`). New unmatched aliases create a new donor and
     are listed in the run report for review;
   - financing → BFS vote number (date + title similarity, plus `config/vote_numbers.yaml`).
6. **load**: upsert everything in one transaction per financing, using `efk_id` / upstream keys. Update `last_seen_run`, then delete
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
