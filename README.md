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

## Planned layout

```
docs/        concept and design documents (this phase)
db/          schema.sql + migrations
pipeline/    scraper + ETL (Python)                  (phase 1–2)
api/         read-only query API                     (phase 3)
web/         front-end                               (phase 4)
config/      view specs, party list/colours, manual overrides (entity resolution)
data/raw/    local raw archive of fetched payloads (git-ignored)
```

## Status

Design phase. Nothing is implemented yet. Start with [ROADMAP.md](ROADMAP.md).
