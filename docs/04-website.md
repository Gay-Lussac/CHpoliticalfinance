# 04 · Website

## Views (first set)

Each view should be understandable in under 10 seconds on a phone. It gets a sentence at the top that states the answer
("The Yes side declared CHF 3.1 M, 2.4× the No side"), and the chart below supports it.

| # | View | Main visual | Secondary | Priority |
|---|---|---|---|---|
| 1 | **Home / overview** | upcoming and recent votes as cards: Yes vs No bar per vote | biggest donors of the last 12 months | MVP |
| 2 | **Vote page** | Yes vs No total (budget and final, side by side) | top actors per side (bars) · revenue sources (stacked bar) · top donors · party recommendations | MVP |
| 3 | **Explorer** | filterable table over allowances or campaign totals | CSV download, shareable URL with filters | MVP |
| 4 | **Donor page** | all donations of one donor over time (dot/timeline) | split by financing, by stance | v1 |
| 5 | **Actor page** | the actor's campaigns and income per campaign | their donors | v1 |
| 6 | **Election page** | totals per party (bars), per canton (small multiples or a map) | top candidates or lists, by council | v1 |
| 7 | **Party financing** | annual income per party, stacked by source | mandate contributions, big donors | v1 |
| 8 | **Timeline / compare** | money per vote over time, Yes vs No | filter by topic or type (initiative vs referendum) | v2 |
| 9 | **Flow** | 2-level Sankey (donors → actors → side), top-N with "others" | replaces the 3D graph | v2 |
| 10 | **Money vs result** | spending gap vs yes % (scatter) | with appropriate caveats | v2 |
| – | **Methodology / About** | text: sources, thresholds, budget vs final, limits | | MVP |

## Flexibility: views as specs

The site must be able to show new things without new backend code. The approach:

1. The API exposes **one generic, whitelisted query endpoint** over the semantic views (`v_flow`, `v_campaign_totals`, …):

   ```
   GET /api/query?dataset=flow&filter[financing_id]=42&filter[phase]=final
                 &group_by=stance,actor_id&measure=sum:value_chf&order=-value&limit=10&lang=fr
   ```

   - `dataset` maps to one SQL view. The allowed `filter`, `group_by` and `measure` fields are declared per dataset in a
     server-side whitelist, which prevents SQL injection and keeps queries cheap.
   - Label joins (`actor_id` → name in `lang`) are resolved by the API, so the front-end never deals with raw ids.
   - Responses are cached (HTTP cache headers + a file cache keyed by query string). Data changes at most daily, so
     the cache is invalidated when the pipeline finishes a run.

2. A few **entity endpoints** feed page headers and search: `/api/financings`, `/api/financings/{id}`, `/api/actors/{id}`,
   `/api/donors/{id}`, `/api/search?q=`.

3. On the front-end, **a view is a JSON/YAML spec**, `config/views/*.yaml`:

   ```yaml
   id: vote-top-actors
   title: { fr: "Principaux acteurs", de: "Wichtigste Akteure" }
   query: { dataset: campaign_totals, group_by: [stance, actor_id], measure: sum:total, limit: 10 }
   params: [financing_id, phase]          # injected from the page URL
   chart: { type: bar, x: total, y: actor_id, color: stance, horizontal: true }
   ```

   A page is a list of view ids. Adding a view means adding a spec and placing it on a page. Adding a dataset (a new SQL view
   plus its whitelist entry) is the only step that touches the backend.

## Front-end stack (proposal)

- **Static build** (Vite) with plain TypeScript, or **Svelte** for components. There is no SSR requirement, so the site can be deployed as static files.
- Charts: **Observable Plot**. It fits declarative specs nicely, is light, and supports bar, stack, dot and small multiples.
  Use d3-sankey for the flow view only.
- i18n: FR, DE, IT and EN. The URL prefix is `/fr/…`. Data labels come from the API in the requested language, and UI strings come from JSON files.
- URLs are the state: filters live in the query string, so any view can be shared and embedded (`?embed=1` hides the chrome).
- Accessibility: every chart has a table fallback ("show data") and a CSV link.

## API stack (proposal)

The API should be small and read-only. The choice depends on the hosting check (see [05-hosting-infomaniak.md](05-hosting-infomaniak.md)):

- **Node.js** (Fastify) if the Infomaniak plan runs Node apps. One language with the front-end.
- **PHP** (Slim, or plain PDO) if not. It works on any Infomaniak web hosting with no process to keep alive.
- **Python** (FastAPI) only on a Cloud Server or VPS.

The query whitelist and dataset definitions are stored in a JSON file shared by the API and the pipeline tests, so they stay
language-agnostic whichever stack is chosen.
