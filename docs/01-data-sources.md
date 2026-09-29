# 01 · Data sources

## A. EFK political financing platform (primary)

Website: https://politikfinanzierung.efk.admin.ch/app/. It is an Angular single-page app built by Sitrox.
The app is backed by an **unauthenticated JSON API**. That API is undocumented: everything below was
reverse-engineered from the app bundle and probed on 2026-09-29. Treat it as unstable. The pipeline must
validate response shapes and fail loudly when they change.

### Base URL and languages

```
https://politikfinanzierung.efk.admin.ch/api/frontend/v1/{lang}/...
```

- `lang` can be `fr`, `de` or `it`, and these are official. `en` and `rm` answer as well but return **German** labels, so
  we translate EN ourselves.
- Download links in responses use `/api/frontend/latest/{lang}/...`. Both `v1` and `latest` currently work.
- Every JSON response has the form `{"data": …, "meta": {"powered_by": "Sitrox", "data_checksum_sha256": "…"}}`.
  **The checksum is our change detector.** If a tree's checksum is unchanged, skip it.

### Tree endpoints (discovery)

All tree endpoints return `data.tree_roots[]`. Each node has `{id, label, type, children[], header_text?, download_path?, campaign_id?}`.

| Endpoint | Content | Node types (depth order) |
|---|---|---|
| `campaign_financings` | all votes and elections (~370 KB) | `campaign_financing` → `actor_category` → `actor` → `campaign` → `form` |
| `party_financings` | annual party financing | `party_financing` (year) → `actor` → `form` |
| `exports?group_by=votes` | votes with bulk downloads | `campaign_financing` → `download` |
| `exports?group_by=elections` | elections with bulk downloads | `campaign_financing` → `download` |
| `exports?group_by=party_financings` | party years with downloads | `party_financing` → `actor` → `form` |
| `actors?group_by=alphabetical` / `by_canton` | actors → categories → campaigns → forms | `canton`? → `actor_category` → `actor` → `financing_category` → … |
| `allowances?group_by=by_amount` / `alphabetical` | every allowance (donation) with its id | `financing_category` → `campaign_financing`/`party_financing` → `budget`/… → `allowance` |
| `people?group_by=election` / `office` | currently empty | — |

Stable identifiers observed:

- `campaign_financing.id`: one per vote *object* or election (e.g. 31 = neutrality initiative, 27 = CN election AR 2026).
- `party_financing.id`: one per year.
- `actor.id`: EFK actor, stable across campaigns (e.g. 407 = "2 x Ja zum Mietrecht / Bund für mehr Wohnraum").
- `campaign.id`: one actor's campaign within one financing, with a stance ("Adoption…" or "Rejet…") or a set of candidates.
- `form.id`: a **form type**, not an instance. (`campaign_id`, `form_id`) identifies one declaration.
- `allowance.id`: one donation.

Form types seen in `campaign_financings` (FR labels):

| Label | Meaning | Count (2026-09-29) |
|---|---|---|
| Déclaration des recettes budgétées | budget totals | 446 |
| Déclaration du décompte final des recettes | final totals | 468 |
| Déclaration de libéralités supérieures à 15 000 francs | budget allowances | 211 |
| … (décompte final) | final allowances | 206 |
| … (y.c. étranger/anonymes) | allowances incl. foreign/anonymous | 23 |

### Detail endpoints

- `campaigns/{campaign_id}/forms/{form_id}` returns one declaration as JSON:
  - totals forms: `form_data.totals = {total, monetary_allowances, non_monetary_allowances, events, sales, equity}`
    (plus `membership_fees`, `mandate_contributions` for parties);
  - allowance forms: `form_data.allowances = {natural_monetary[], juristic_monetary[], natural_non_monetary[]?, …}`,
    where each item is `{natural_first_name, natural_name, natural_city, living_abroad, value, date}` or `{juristic_name, juristic_city, …}`.
  - ⚠ Amounts are **formatted strings** (`"CHF 51'263.95"`, `"2'000'000.00"`) and dates are `dd.mm.yyyy`. Parse them strictly.
  - ⚠ Allowance items in this endpoint have **no id**. The ids come from the `allowances` tree.
- `allowances/{id}` returns the detail of one allowance.
- `people/{id}` returns a person (for elections; not yet exercised).

### Bulk downloads (xlsx)

- `downloads/financings/{campaign_financing_id}?with_budget=true|false` returns one xlsx per vote or election (budget or final),
  with sheets `Recettes totales` and `Libéralités`.
- `downloads/campaigns/{campaign_id}/forms/{form_id}` returns the xlsx for a single declaration (party forms add a
  `Contributions liées à un mandat` sheet).
- Column sets **vary by date and type**:
  - recent exports include `ID acteur`, `ID campagne`, `ID déclaration` and `ID libéralité`, plus the column `Acteur/trice`;
  - older exports (e.g. financing 13, Nov 2024) have no IDs and use the column `Acteur`;
  - election exports add `Campagne pour, Nom, Prénom, Groupement politique candidat, Canton, Affiliation au parti politique national (parti-mère)`;
  - `Base de données` holds the export timestamp, not a data field.

**Recommended strategy:** use the JSON trees for discovery and IDs. Use the JSON detail endpoints as the primary
content, because they are structured, exist in 3 languages and carry per-form checksums. Use the xlsx exports as a
reconciliation check, and as the source of election-specific columns until the JSON equivalent is confirmed.
Decide this after the phase 1 spike (see ROADMAP).

### Size and politeness

About 1 400 forms × 3 languages is ~4 000 small requests for a full backfill. Incremental runs are much cheaper
thanks to the checksums. Throttle to about 2 req/s, send an identifying `User-Agent` with a contact email,
and back off on 429 or 5xx. Also send the EFK a short courtesy email about the reuse; they may offer a supported feed.

## B. Party voting recommendations (BFS)

- The legacy project used the BFS table `je-f-17.03.01.04.xlsx` ("Recommandations des partis pour les votations fédérales").
  It has one sheet per year (1970–2024), rows = parties, columns = vote numbers (`no 6650`) grouped by date, and values Oui/Non/free…
- The file needs messy header parsing, and newer years may lag. Check opendata.swiss and the BFS API for a machine-readable version.
- Join key: the **BFS vote number** (e.g. 6650). EFK financings do not carry it, so a mapping `financing ↔ vote_number`
  is needed. Match on date and title, with manual overrides.

## C. Vote results (enrichment, later)

- opendata.swiss publishes the federal vote results (BFS "Eidgenössische Abstimmungen", JSON per vote date), keyed by vote number.
  They give yes %, turnout and cantonal results, so "money vs result" views become possible.

## D. Election results and party metadata (enrichment, later)

- BFS election results (NR/SR 2023), and party abbreviations, colours and national parent parties.
  The legacy project hard-coded colours; move them to `config/parties.yaml`.

## E. Legacy data (one-off)

- `../Python Treatment/**.xlsx` and `../Git_copy/CHpoliticalgraphs/*/*.json`. Use them only as a **regression reference**:
  after the first backfill, the per-vote totals in the new DB should match the old ones, unless the EFK has revised the data since.
