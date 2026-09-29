# CHpoliticalfinance · [polimoney.ch](https://polimoney.ch)

**Who funds Swiss votes, elections and parties, and how much?** This project turns the official declarations
published by the Swiss Federal Audit Office (EFK/CDF) into short, readable views, updated automatically every night.
The site is available in French, German, Italian and English.

## What the site shows

- **Votes:** money declared for the Yes and No sides (budget and final accounts, side by side), the main actors and
  donors, where the money comes from, the **result** (accepted/rejected, % yes, cantons, turnout) and the **voting
  recommendations** of the parties and main federations.
- **Elections:** revenue by party, by canton, main actors and donors.
- **Parties:** annual revenue of the national parties by source, big donors and mandate contributions.
- **Actors and donors:** every campaign an organisation ran or funded, and for each donor the **alignment of their
  money with each party's recommendations**. This is computed only from the declared donations and explained on the
  page; it says nothing about anyone's opinions.
- **Explorer:** filter, group and download any dataset as CSV; the URL keeps the selection.

## Data sources

| Source | What | Licence / basis |
|---|---|---|
| [politikfinanzierung.efk.admin.ch](https://politikfinanzierung.efk.admin.ch) | declarations of revenue and donations above CHF 15 000 (votes, elections, party years) | published under the federal transparency rules (LDP art. 76b ff.) |
| [Swissvotes](https://swissvotes.ch) (Année politique suisse, University of Bern) | ballot questions, results, recommendations, English titles | CC BY 4.0 |

No data is stored in this repository: the pipeline fetches it. Details: [docs/01-data-sources.md](docs/01-data-sources.md).

## How it works

```
EFK JSON API ─┐                                          ┌─► Node API (read-only, whitelisted queries)
              ├─► pipeline (Python, nightly) ─► MariaDB ─┤
Swissvotes ───┘   raw archive · strict parsing · checks  └─► website (Vite + TypeScript, YAML view specs)
```

1. **Pipeline:** each night it fetches only what changed, keeps every payload in a raw archive (the DB can be rebuilt
   from it), parses strictly, matches ballots to votes, loads MariaDB and runs consistency checks.
   See [docs/03-pipeline.md](docs/03-pipeline.md).
2. **Database:** the domain model (financings, actors, campaigns, declarations, donations, donors, ballots,
   recommendations) plus a semantic layer of SQL views. See [docs/02-database.md](docs/02-database.md).
3. **API:** one generic `/api/query` endpoint over those views, restricted by a whitelist
   ([config/datasets.json](config/datasets.json)), plus a few entity endpoints. It uses a read-only DB user.
4. **Website:** each page is a list of views declared in `config/views/<page>.yaml`. A new chart needs no backend code.
   See [docs/04-website.md](docs/04-website.md).

Concept and principles: [docs/00-concept.md](docs/00-concept.md) · hosting: [docs/05-hosting-infomaniak.md](docs/05-hosting-infomaniak.md)
· plan: [ROADMAP.md](ROADMAP.md).

## Layout

```
pipeline/      scraper + ETL (Python ≥ 3.9): `pipeline sync | rebuild | check | resolve --review`
api/           read-only query API (Node + Fastify); also serves the built site
web/           front-end (Vite + TypeScript + Observable Plot), 4 languages
db/            schema.sql · migrations/ · views.sql (semantic layer)
config/        datasets.json (API whitelist) · views/*.yaml (what each page shows) · parties.yaml ·
               recommenders.yaml · cantons.yaml · actor_party.yaml · donor_overrides.yaml · vote_numbers.yaml
deploy/        server scripts: setup, DB init, pipeline wrapper, nightly cron entry, deploy
docs/          design documents
```

## Run locally

Prerequisites (macOS): `brew install mariadb node`, then `brew services start mariadb`, plus Python ≥ 3.9.

```bash
cp .env.example .env        # then set the two DB passwords
make setup                  # venv + npm installs + local DB, users, schema, migrations, views
make sync-full              # first full load from the EFK and Swissvotes (~10 min)
make api                    # terminal 1 → http://127.0.0.1:8787/api/meta
make web                    # terminal 2 → http://localhost:5173
```

Day to day:
- `make sync`: fetch what changed;
- `make rebuild`: reload the DB from the archive after a schema, config or parser change;
- `make review`: list possible duplicate donors;
- `make test`: run the tests.

**To change what a page shows**, edit `config/views/<page>.yaml` (format in [config/views/README.md](config/views/README.md)).
A new field or dataset means adding a column to a view in `db/views.sql` and whitelisting it in `config/datasets.json`.

## Branches and releases

| Branch | Role |
|---|---|
| `dev` | work in progress (default branch). Every change is committed here first and tested locally. |
| `main` | **production**: what polimoney.ch runs. Protected, so changes arrive only through a pull request `dev → main`. |

After merging a pull request:
- **website:** rebuild the Node.js site (its build command pulls `main`), then restart it;
- **pipeline:** run `deploy/deploy.sh` on the server;
- **database changes:** apply `deploy/init-db.sh` as the admin user, then run one sync.

The exact order is in [docs/05-hosting-infomaniak.md](docs/05-hosting-infomaniak.md).

## Status

Live at **[polimoney.ch](https://polimoney.ch)** since September 2026. The data covers every federal vote since March
2024, the 2023 federal elections and later by-elections, and national party financing since 2023. It is refreshed nightly.
Next steps are in the [ROADMAP](ROADMAP.md).

## Licence

Code: [MIT](LICENSE). Data belongs to its publishers (EFK/CDF; Swissvotes, CC BY 4.0) and is not part of this repository.
