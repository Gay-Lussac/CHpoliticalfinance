# Roadmap

Each phase ends with something usable or verifiable. Its "Done when" line is the exit criterion.
The phases run in order, but the design docs for later phases are refined while earlier ones are built.

## Phase 0 · Foundations

- [ ] Fill in the Infomaniak checklist ([docs/05](docs/05-hosting-infomaniak.md)), then freeze the stack (API: Node vs PHP; pipeline runs on the host vs in GitHub Actions)
- [ ] Create the GitHub repo and push this skeleton. Archive CHpoliticalgraphs with a pointer to the new project.
- [x] Set up local MariaDB and check that `db/schema.sql` applies cleanly
- [ ] Decide the domain name and languages for launch (proposal: FR + DE at MVP, then IT and EN)
- [ ] Optional: send the EFK a courtesy email about reusing their API

**Done when:** hosting capabilities are known, the stack is decided and the schema loads locally.
*Local stack decided and running: MariaDB 13 (Homebrew), Python pipeline, Node/Fastify API, Vite/TS front-end.*

## Phase 1 · Source spike and raw archive

- [x] `pipeline discover`: walk all trees and dump an inventory (financings, actors, campaigns, forms, allowances with ids)
- [ ] Map allowance ids (allowances tree) to detail rows; rows are currently keyed by a content hash. Open questions: does allowance tree `id` = xlsx `ID libéralité`? What do election campaigns and candidates look like in JSON? Is `people/{id}` usable?
- [x] Decide JSON detail vs xlsx as the primary content source (see [docs/01](docs/01-data-sources.md))
- [x] `fetch` + `archive` with checksums, throttling, retries and 3 languages
- [x] Full backfill into `data/raw/`

**Done when:** the complete EFK dataset is archived locally and a second run fetches nothing.

## Phase 2 · Database and ETL

- [x] Strict parsers for every payload type (votes, elections, party years; budget and final; totals, allowances and mandates)
- [x] Load into MariaDB with upserts, `first_seen/last_seen` and removal mirroring
- [x] `config/parties.yaml` (codes, colours and name patterns) and the actor → party mapping
- [x] Donor resolution v1 (normalised key) and the review workflow (`resolve --review`, `donor_overrides.yaml`)
- [x] Invariant checks and the run report
- [ ] `import-legacy`: compare totals against the old CHpoliticalgraphs JSONs and explain every difference
- [x] `pipeline rebuild` (from the archive)
- [x] Update the schema from what the spike taught us (migrations from here on)

**Done when:** the DB rebuilds from the archive, the checks pass and the legacy comparison is explained.

## Phase 3 · Query API

- [x] Dataset whitelist (`config/datasets.json`) and the `/api/query` endpoint
- [x] Entity endpoints and `/api/search`
- [x] i18n label resolution and caching, with invalidation on pipeline runs
- [x] Read-only DB user and CORS for embeds
- [ ] Rate limiting (at deploy time)

**Done when:** every MVP view can be fed by an API call and responses are cached.

## Phase 4 · Website MVP

- [x] App shell: navigation, language switch, URL state, mobile-first layout
- [x] View spec renderer (spec → query → Observable Plot) with table and CSV fallback
- [x] Views: Home, Vote page, Explorer, Methodology/About
- [x] SEO basics and `noindex` on donor pages (see [docs/00](docs/00-concept.md), personal data)

**Done when:** the site is deployed on Infomaniak with real data for every vote since 2024. *(Live at https://polimoney.ch since 2026-09-29.)*

## Phase 5 · Automation and operations

- [x] Daily cron for `pipeline sync` (03:15, Infomaniak SSH space)
- [ ] Notifications: failure, new data published, unreviewed donor aliases
- [ ] Off-host backup of the raw archive, plus a check that DB backups can be restored
- [ ] Simple status page or footer ("data updated on …")

**Done when:** a new EFK publication appears on the site without manual action.

## Phase 6 · More views (v1)

- [x] Donor page and Actor page
- [x] Election page (2023 federal elections plus by-elections)
- [x] Party financing page (annual; mandate contributions)
- [x] IT and EN interface (`web/src/i18n.ts`, view specs, About page). IT data labels are official; EN data labels fall back to FR
- [ ] EN titles for votes/elections (our own translations, `i18n_label` rows with `is_official = FALSE`)
- [ ] Review donor duplicates (`make review`) and map remaining actors (e.g. "Union Populaire") in `config/actor_party.yaml`

## Phase 7 · Enrichment (v2)

- [x] Match each vote to its Swissvotes/BFS ballots; import results, party + federation recommendations and English titles (nightly)
- [x] Vote results (Swissvotes) on vote pages and cards
- [x] Donor alignment with party/federation recommendations (organisations only; privacy guard in the API)
- [ ] "Money vs result" and "money by recommending camp" views
- [ ] Positioning on economic/social axes: deferred. Not expected from the EFK (neutral mandate). It would need party positions
  (e.g. CHES) and should cover organisations only, never private donors (political opinions = sensitive personal data)
- [ ] Timeline and compare views; topic tagging of votes
- [ ] Flow view (2D Sankey, top N)
- [ ] Embeddable widgets for media

## Ideas / later

- Cantonal transparency regimes (GE, NE, FR, SZ, TI, SH, VS…): each one is a new source adapter feeding the same model
- Change history ("this declaration was revised on …") from the raw archive
- Public read-only data dump (CSV/SQLite) under an open licence
- Alerts: "notify me when a new donor above CHF 100 k appears"

## Carried over from the legacy project

| Item | Where it was | What to do |
|---|---|---|
| BFS recommendations file | `Votations/Recommendations/je-f-17.03.01.04.xlsx` (downloaded, never parsed) | superseded by Swissvotes |
| Colour palette (per node *type*, e.g. Yes `#32CD32`, No `#FF4500`) | notebooks | optional starting point; party colours still to define in `config/parties.yaml` |
| Translation dictionary | `Dictionary builder/` | **drop**: the API serves FR/DE/IT labels |
| Intro and explanatory texts (FR/DE/EN) | `index*.html` | starting point for the About page |
| Old graph JSONs | `Git_copy/CHpoliticalgraphs/*/*.json` | regression reference only (phase 2) |
