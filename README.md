# CHpoliticalfinance

Successor to [CHpoliticalgraphs](https://github.com/Gay-Lussac/CHpoliticalgraphs).
It makes Swiss political financing data understandable: who finances which
vote, election campaign and party, and how much.

Data comes from the Swiss Federal Audit Office (CDF/EFK) transparency platform,
politikfinanzierung.efk.admin.ch. It is published under the federal transparency
rules for political financing (LDP art. 76b ff.), which have applied since 2023.

## What changes compared to CHpoliticalgraphs

| Before | Now |
|---|---|
| xlsx downloaded by hand, processed in notebooks | Automatic, scheduled scraper of the EFK JSON API |
| One big pre-computed graph JSON per topic (≈8 MB) | Relational database (MariaDB) as the single source of truth |
| 3D force graphs as the only view | Short, focused 2D views (rankings, splits, flows, timelines) |
| Every new view = a new notebook + new JSON | New views are declared as *view specs* over one query API |
| Translations built by hand from xlsx in 3 languages | FR/DE/IT labels fetched directly from the source API |

## The four building blocks

1. **Sources**: what exists upstream and how to fetch it. See [docs/01-data-sources.md](docs/01-data-sources.md).
2. **Pipeline**: scheduled, idempotent scraping into a raw archive, then normalisation into the DB. See [docs/03-pipeline.md](docs/03-pipeline.md).
3. **Database**: the domain model. See [docs/02-database.md](docs/02-database.md) and [db/schema.sql](db/schema.sql).
4. **Website**: flexible views on top of one query API. See [docs/04-website.md](docs/04-website.md).

The concept and scope are in [docs/00-concept.md](docs/00-concept.md), the hosting constraints in
[docs/05-hosting-infomaniak.md](docs/05-hosting-infomaniak.md), and the plan in [ROADMAP.md](ROADMAP.md).

## Layout

```
docs/          concept and design documents
db/            schema.sql (tables) · views.sql (semantic layer read by the API) · migrations/ · scripts/
pipeline/      scraper + ETL (Python): `pipeline sync | rebuild | check | resolve --review`
api/           read-only query API (Node + Fastify); also serves the built site
web/           front-end (Vite + TypeScript + Observable Plot)
config/        datasets.json (API whitelist) · views/*.yaml (what each page shows) ·
               parties.yaml · cantons.yaml · actor_party.yaml · donor_overrides.yaml
data/raw/      raw archive of every fetched payload (git-ignored; the DB can be rebuilt from it)
data/reports/  one markdown report per pipeline run (git-ignored)
```

## Run locally

Prerequisites (macOS): `brew install mariadb node`, then `brew services start mariadb`, plus Python ≥ 3.9.

```bash
cp .env.example .env        # then set two passwords
make setup                  # venv + npm installs + DB, users, schema, views
make sync-full              # first backfill from the EFK (~10 min, ~1 400 requests)
make api                    # terminal 1 → http://127.0.0.1:8787/api/meta
make web                    # terminal 2 → http://localhost:5173
```

Day to day: `make sync` fetches what changed. `make rebuild` reloads the DB from the archive after
a schema, config or parser change. `make test` runs the tests, and `make serve` runs site + API as one process.

**To add or change what a page shows**, edit `config/views/<page>.yaml` (see
[config/views/README.md](config/views/README.md)). The dev server reloads automatically. A new field or
dataset means adding a column to a view in `db/views.sql` and whitelisting it in `config/datasets.json`.

## Status

Phases 1–4 of the [ROADMAP](ROADMAP.md) run locally with the complete EFK dataset:
29 votes, 4 elections and 3 party-years, with 393 actors, 1 406 declarations and 2 026 allowances.
Hosting on Infomaniak and the GitHub repo are still open.

## Branches and deployment

| Branch | Role |
|---|---|
| `main` | **production**: the only branch deployed to polimoney.ch. Protected: changes arrive only through a pull request, with no direct or force pushes. |
| `dev` | **work in progress** (default branch). All changes are committed here first. |

Workflow: commit on `dev` and test locally. When it's ready, open a pull request `dev → main` and merge it,
then run `deploy/deploy.sh` on the server. The script only ever fast-forwards the server to `origin/main`.

```bash
gh pr create --base main --head dev --fill      # propose dev for production
gh pr merge --merge                             # after checking the diff
ssh xb5xa5_SSH_Admin@xb5xa5.ftp.infomaniak.com 'cd ~/chpf && deploy/deploy.sh'
```

## Licence

Code: [MIT](LICENSE). Data: published by the Swiss Federal Audit Office (EFK/CDF) on
politikfinanzierung.efk.admin.ch. The data is not part of this repository; the pipeline fetches it.
