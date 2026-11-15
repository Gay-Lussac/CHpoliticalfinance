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

## B. Ballots, results and recommendations: Swissvotes (implemented)

- **Swissvotes** is run by Année politique suisse at the University of Bern. The whole dataset is **one CSV**
  (`https://swissvotes.ch/page/dataset/swissvotes_dataset.csv`, ~3 MB, ~700 votes since 1848) under **CC BY 4.0**,
  so the site credits it wherever its data appears. The codebook is `https://swissvotes.ch/page/dataset/codebook-de.pdf`.
- Used columns:
  - `anr` (official vote number), `datum`, `rechtsform` (legal form);
  - `titel_off_f` (for matching), `titel_kurz_d/f/e` (short titles; **EN** titles also serve as the English vote titles);
  - `annahme`, `volkja-proz`, `bet`, `kt-ja` (outcome, % yes, turnout, cantons in favour);
  - `p-<org>` recommendations. The organisations shown are listed in `config/recommenders.yaml` (11 parties + 6 federations).
    Codes: 1 yes · 2 no · 3 none · 4 blank · 5 free · 8/9 tie-break preference · 9999 organisation did not exist.
- **One EFK vote can cover several ballots.** An initiative with a direct counter-proposal is one EFK campaign but three
  Swissvotes ballots (initiative, counter-proposal, tie-break). Ballots are matched to EFK votes by date and by title similarity
  or containment. Unclear matches are reported, never guessed, and can be forced in `config/vote_numbers.yaml`.
- **Updates:** fetched on every nightly sync and archived only when changed. Recommendations appear in the weeks before a vote,
  and results on the evening of voting day. If Swissvotes is down, the EFK sync still runs and keeps the previous data.
- The BFS table `je-f-17.03.01.04.xlsx` used by the legacy project is no longer needed.

## C. Municipal vote results (optional, later)

- Per-municipality results (BFS/opendata.swiss) would allow "money vs result by region" views. Not needed yet:
  Swissvotes already provides the national and cantonal results.

## D. Election results and party metadata (enrichment, later)

- BFS election results (NR/SR 2023), and party abbreviations, colours and national parent parties.
  The legacy project hard-coded colours; move them to `config/parties.yaml`.

## E. Legacy data

The previous project's Excel downloads and graph JSONs served as a one-off regression reference: per-vote totals in the
new DB matched them exactly. They were removed on 2026-09-29.

## F. Lobbywatch: ties of members of parliament (implemented)

Website: https://lobbywatch.ch, data export page https://lobbywatch.ch/datenexport/. Licence **CC BY-SA 4.0** for current
data (see their data guide, `lobbywatch_daten_merkblatt.pdf`). Historical data is copyrighted and is **not** imported.
Lobbywatch is one source among several here, so attribution is enough ("share-alike" applies only when it is the main
source); it is credited in the footer, on the About page and under every block that shows its data.

- Source file: the weekly "flat" CSV export `lobbywatch_export_flat.csv.zip` (~4 MB zipped, ~17 MB unpacked,
  tab-separated, refreshed early Monday morning). Fetched at most once every 6 days; the last 4 versions are kept in
  the raw archive (`payloads/lw/…`). The zip is read in memory, never extracted.
- Used tables: `parlamentarier` (246 current members), `interessenbindung` (current ties only: no end date),
  `interessenbindung_jahr` (latest remuneration: -1 paying member, 0 unpaid, 1 paid amount not disclosed, >1 CHF/year),
  `organisation` (only those with a current tie, ~2 700), `interessengruppe`.
- Matching (`pipeline/chpf/lobbywatch.py`): members → EFK candidates by name letters + canton (both name orders,
  full or short first name; all exact spellings kept). Organisations → EFK actors and legal donors on identical
  normalised names only (legal forms, bracketed abbreviations and punctuation ignored), unambiguous on both sides.
  Corrections in `config/lobbywatch_matches.yaml`.
- Tables: `lw_parliamentarian`, `lw_candidate`, `lw_organisation`, `lw_tie`, `lw_meta` (migration 004), reloaded in full
  on every sync. If the export fails, the previous data stays.
- The dataIF REST API (`cms.lobbywatch.ch/de/data/interface/v1/json/…`) returned 0 records when tested (2026-11-15);
  the export is the reliable route.

## G. National Council final votes (implemented)

Parliamentary Services of the Federal Assembly, open data web service `https://ws.parlament.ch/odata.svc` (OData v2, no
key). Terms: credit "Services du Parlement de l'Assemblée fédérale, Berne" with the download date, unchanged data, not
presented as an official publication. This service is to be retired by the end of 2028; its successor `ws.parl.ch` needs a
free API key (registration by the site operator) and adds Council of States individual votes.

- `Vote` (one per recorded vote) filtered on `BusinessShortNumber` = Swissvotes `gesch_nr` and subject "Vote final" or
  "Schlussabstimmung" (the subject language varies); `Voting` (one row per member: `PersonNumber`, group, `Decision`
  1 yes, 2 no, 3 abstain, 4/5 absent, 6 excused, 7 chair).
- The final vote used for a ballot is the one whose yes/no counts equal Swissvotes `nrja`/`nrnein`, directly or
  reversed (± 2): reversed = Parliament voted on its recommendation decree (popular initiatives), stored as `inverted`.
- Fetched once per business and vote (re-fetched while still empty), archived under `payloads/pa/…`; ~30 votes, ~6 000 rows.
- `PersonNumber` = Lobbywatch `parlament_biografie_id`, which links votes to candidate pages (`lw_parliamentarian.parl_person_number`).
- Tables `parl_vote`, `parl_voting` (migration 006).
