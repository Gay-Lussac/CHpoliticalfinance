# 02 · Database

Target engine: **MariaDB 10.6+ / MySQL 8**, which is what Infomaniak web hosting provides. PostgreSQL would be nicer,
but on Infomaniak it requires a Cloud Server. The schema therefore sticks to portable SQL: no arrays, and JSON only for raw payloads.
The tables are in [../db/schema.sql](../db/schema.sql), with changes after that in [../db/migrations/](../db/migrations/). The semantic views are in [../db/views.sql](../db/views.sql).

## Domain model

Everything upstream is a **declaration** made by an **actor**, inside a **campaign**, for a **financing**.

```
financing ─┬─ vote_object (1:1, kind = vote)          ← BFS vote number, results, recommendations
           ├─ election    (1:1, kind = election)      ← council, canton
           └─ (kind = party_year)
     │
     └── campaign ── actor                  (actor's campaign in this financing; stance = for/against/candidates)
            │         └─ party (optional mapping: cantonal section → national party)
            └── declaration  (phase = budget | final, kind = totals | allowances)
                   ├── declaration_totals        (1:1 when kind = totals)
                   ├── allowance ── donor        (n, when kind = allowances)
                   └── mandate_contribution      (n, party_year only)
```

| Table | Grain | Upstream key |
|---|---|---|
| `financing` | one vote object, one election or one party year | `campaign_financing.id` / `party_financing.id` (+ kind) |
| `vote_object` | extra data for a vote financing | BFS vote number (mapped) |
| `election` | extra data for an election financing | — |
| `actor` | EFK actor (committee, association, party section, person) | `actor.id` |
| `party` | national party (our curated list) | — (config) |
| `actor_party` | actor → party mapping, e.g. "Die Mitte Kanton Zug" → Centre | — (config + heuristics) |
| `campaign` | an actor's campaign within a financing | `campaign.id` |
| `candidate` + `campaign_candidate` | candidates covered by an election campaign | parsed from "Campagne pour" / Nom / Prénom |
| `declaration` | one submitted form (phase × kind) | (`campaign.id`, `form.id`) or `ID déclaration` |
| `declaration_totals` | revenue breakdown of one declaration | — |
| `donor` | resolved donor (natural or legal person) | — (entity resolution) |
| `donor_alias` | raw spelling seen upstream → donor | normalised name + city |
| `allowance` | one donation (> CHF 15 000) | `allowance.id` |
| `mandate_contribution` | mandate levies paid to a party | — |
| `ballot` | one ballot question (N per EFK vote: initiative, counter-proposal, tie-break) with its result | Swissvotes `anr` |
| `recommender` | party or federation whose recommendation is shown (`config/recommenders.yaml`) | Swissvotes column `p-<code>` |
| `ballot_recommendation` | recommender × ballot → yes/no/none/blank/free/tie-break preference | Swissvotes |
| `i18n_label` | FR/DE/IT(/EN) labels for any entity | — |
| `fetch_run`, `raw_payload` | provenance: what we fetched, when, with which checksum | — |

## Key decisions

1. **Surrogate PKs and upstream `efk_id` columns with UNIQUE constraints.** Upstream IDs are foreign and could be
   renumbered. Loads are upserts on `efk_id`.
2. **Budget and final are separate declarations** (`phase` column), never overwritten by each other. Both views
   ("announced" and "actual") and the gap between them come for free.
3. **Amounts are `DECIMAL(14,2)` in CHF.** Never floats. The legacy JSONs mixed strings and floats.
4. **Stance is normalised** to `for` / `against` for votes, from the labels "Adoption/Rejet de l'objet". For elections
   the campaign has candidates instead of a stance.
5. **Labels live in `i18n_label`** (entity, id, field, lang) rather than in `title_fr/de/it` columns. There are three official
   languages plus our EN, and more labelled entities will come. For convenience, each main table also keeps a `name` column in the
   source language as a fallback.
6. **Donor entity resolution is explicit and reviewable.** Every raw spelling becomes a `donor_alias` row pointing to a
   `donor`. Automatic matching (normalised name + city) proposes links. `config/donor_overrides.yaml` in git has the last word.
   This is the hardest data problem in the project: cross-campaign donor views are only as good as this table.
7. **Soft history.** Each loaded row carries `first_seen_run` / `last_seen_run`. Rows that disappear upstream are deleted
   from the serving tables. The raw archive keeps the history, so we mirror upstream corrections and removals.
8. **A semantic layer of SQL views** is what the API queries. It flattens the model into the few shapes the website needs:

   | View | Grain | Typical use |
   |---|---|---|
   | `v_flow` | one allowance: donor → actor → campaign → financing, with phase, amount and `is_latest` | Sankey, donor pages, rankings |
   | `v_campaign_totals` | one campaign × phase with the revenue breakdown | Yes vs No bars, budget vs final |
   | `v_financing_summary` | one financing × phase × stance | overview cards, timelines |
   | `v_party_year` | one party × year with its sources | party financing page |

   Views can later become materialised tables that the ETL refreshes, if performance requires it. At this data
   volume (~10⁴ allowances) it will not.

## Open questions

- Does the allowances tree's `id` match `ID libéralité` in the xlsx? This is needed to join the JSON and xlsx sources (phase 1 spike).
- For elections, is a campaign one per list, per candidate or per party section? It varies by actor and needs analysis of the 2023 data.
- Non-monetary allowances: keep `service_type` + `description` only in the source language?
- Anonymous and foreign allowances: model them as a special `donor` ("anonymous") or with a flag on `allowance`? The draft uses flags.

## Findings from the first load (2026-09-29)

- **Budget and final double-count.** The same donation usually appears in both the budget and the final declaration. Any view mixing
  phases must filter `is_latest` (final if published, otherwise budget); the donor and actor pages do.
- **Donations listed above the declared totals.** 15 budget declarations list more in allowances than their own
  declared allowance totals. This is an upstream inconsistency, reported by `pipeline check`.
- **Canton.** Election campaigns take the canton of their candidates (`campaign.canton`). National campaigns
  ("dans toute la Suisse") have none and are shown as "all of Switzerland".
- **Donor duplicates** such as "Martullo-Blocher Magdalena" vs "Martullo Blocher Magdalena Silvia", or "economiesuisse" vs its long
  form, exist. `pipeline resolve --review` lists them for `config/donor_overrides.yaml`.
