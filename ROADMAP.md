# Roadmap

Each phase ends with something usable or verifiable. Its "Done when" line is the exit criterion.
The phases run in order, but the design docs for later phases are refined while earlier ones are built.

## Phase 0 · Foundations

- [ ] Fill in the Infomaniak checklist ([docs/05](docs/05-hosting-infomaniak.md)), then freeze the stack (API: Node vs PHP; pipeline runs on the host vs in GitHub Actions)
- [ ] Create the GitHub repo and push this skeleton. Archive CHpoliticalgraphs with a pointer to the new project.
- [ ] Set up local MariaDB and check that `db/schema.sql` applies cleanly
- [ ] Decide the domain name and languages for launch (proposal: FR + DE at MVP, then IT and EN)
- [ ] Optional: send the EFK a courtesy email about reusing their API

**Done when:** hosting capabilities are known, the stack is decided and the schema loads locally.

## Phase 1 · Source spike and raw archive

- [ ] `pipeline discover`: walk all trees and dump an inventory (financings, actors, campaigns, forms, allowances with ids)
- [ ] Answer the open questions: does allowance tree `id` = xlsx `ID libéralité`? What do election campaigns and candidates look like in JSON? Is `people/{id}` usable?
- [ ] Decide JSON detail vs xlsx as the primary content source (see [docs/01](docs/01-data-sources.md))
- [ ] `fetch` + `archive` with checksums, throttling, retries and 3 languages
- [ ] Full backfill into `data/raw/`

**Done when:** the complete EFK dataset is archived locally and a second run fetches nothing.

## Phase 2 · Database and ETL

- [ ] Parsers and pydantic models for every payload type (votes, elections, party years; budget and final; totals, allowances and mandates)
- [ ] Load into MariaDB with upserts, `first_seen/last_seen` and removal mirroring
- [ ] `config/parties.yaml` (codes, colours and name patterns) and the actor → party mapping
- [ ] Donor resolution v1 (normalised key) and the review workflow (`resolve --review`, `donor_overrides.yaml`)
- [ ] Invariant checks and the run report
- [ ] `import-legacy`: compare totals against the old CHpoliticalgraphs JSONs and explain every difference
- [ ] `rebuild --from-archive`
- [ ] Update the schema from what the spike taught us (migrations from here on)

**Done when:** the DB rebuilds from the archive, the checks pass and the legacy comparison is explained.

## Phase 3 · Query API

- [ ] Dataset whitelist (`config/datasets.json`) and the `/api/query` endpoint
- [ ] Entity endpoints and `/api/search`
- [ ] i18n label resolution and caching, with invalidation on pipeline runs
- [ ] Read-only DB user, rate limiting and CORS for embeds

**Done when:** every MVP view can be fed by an API call and responses are cached.

## Phase 4 · Website MVP

- [ ] App shell: navigation, language switch, URL state, mobile-first layout
- [ ] View spec renderer (spec → query → Observable Plot) with table and CSV fallback
- [ ] Views: Home, Vote page, Explorer, Methodology/About
- [ ] SEO basics and `noindex` on donor pages (see [docs/00](docs/00-concept.md), personal data)

**Done when:** the site is deployed on Infomaniak with real data for every vote since 2024.

## Phase 5 · Automation and operations

- [ ] Daily cron (or GitHub Action) for `pipeline sync`
- [ ] Notifications: failure, new data published, unreviewed donor aliases
- [ ] Off-host backup of the raw archive, plus a check that DB backups can be restored
- [ ] Simple status page or footer ("data updated on …")

**Done when:** a new EFK publication appears on the site without manual action.

## Phase 6 · More views (v1)

- [ ] Donor page and Actor page
- [ ] Election page (2023 federal elections plus by-elections)
- [ ] Party financing page (annual; mandate contributions)
- [ ] IT and EN translations

## Phase 7 · Enrichment (v2)

- [ ] Map each financing to its BFS vote number; import party recommendations (BFS table, or better a machine-readable source)
- [ ] Vote results (opendata.swiss): "money vs result" view
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
| BFS recommendations file | `Votations/Recommendations/je-f-17.03.01.04.xlsx` (downloaded, never parsed) | input for the phase 7 importer |
| Colour palette (per node *type*, e.g. Yes `#32CD32`, No `#FF4500`) | notebooks | optional starting point; party colours still to define in `config/parties.yaml` |
| Translation dictionary | `Dictionary builder/` | **drop**: the API serves FR/DE/IT labels |
| Intro and explanatory texts (FR/DE/EN) | `index*.html` | starting point for the About page |
| Old graph JSONs | `Git_copy/CHpoliticalgraphs/*/*.json` | regression reference only (phase 2) |
