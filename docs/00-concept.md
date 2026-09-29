# 00 · Concept

## Purpose

Answer simple questions about Swiss political money quickly, with sources:

- **Per vote:** how much was raised for the Yes and No sides? Who were the main actors and main donors? How did the budget compare with the final count?
- **Per election:** how much did each party, list or candidate declare, by canton and by council?
- **Per party (annual):** where does a party's money come from (donations, members, mandate contributions)?
- **Per donor:** across all campaigns, where did this person or company give money, and how much?
- **Per actor:** what did this committee, association or party section fund, and over which campaigns?
- **Over time:** is campaign money growing? Which topics attract the most money?

The old site answered these questions through one large graph. The new one answers each question in its own
small view, reachable in one or two clicks. Every view links to the underlying rows and to the EFK source.

## Audience

1. Curious citizens, typically on a phone and arriving from a news article: they want a clear view of one vote.
2. Journalists and researchers: they want filters, cross-campaign donor views and CSV export.
3. Us, the maintainers: we need to add a new view without touching the pipeline.

## Principles

- **The database is the truth. The website only reads.** The front-end never uses pre-baked, view-specific JSON.
- **Keep the raw data.** Every fetched payload is archived with its checksum and fetch time, so the DB can be
  rebuilt from the archive and data revisions can be traced.
- **Keep the official labels.** Use the EFK's FR/DE/IT wording. Only English (and our own explanations) are
  translated by us.
- **Budget ≠ final.** Both phases are stored and shown side by side, never merged.
- **Flexible by design.** A view is a spec: a dataset, filters, a grouping, a measure and a chart type. New views should need
  no new SQL or API endpoints in most cases.
- **Cheap to host.** The stack must fit Infomaniak web hosting ([05-hosting-infomaniak.md](05-hosting-infomaniak.md)).

## Out of scope (for now)

- 3D graphs (dropped). A small 2D flow view (Sankey or a simple network) may come back for donor and actor pages only.
- Cantonal and communal transparency regimes (GE, NE, FR, SZ, TI, …): different sources and formats. Listed as a later idea.
- Editorial content and commentary beyond short methodology notes.

## Personal data

Donors who are natural persons (above CHF 15 000) are published by law. We still:

- show only what the EFK publishes, never enriched from other sources (no address lookups, no social profiles);
- keep donor pages `noindex` at first, then decide deliberately;
- provide a contact for correction requests and mirror any upstream removal on the next sync. The pipeline deletes
  what disappears upstream; see [03-pipeline.md](03-pipeline.md).
