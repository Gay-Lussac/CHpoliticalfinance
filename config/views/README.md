# View specs

One file per page. A page is an ordered list of views; a view is a query + a chart.
Adding a view = adding an entry here (no backend change). See docs/04-website.md.

```yaml
- id: unique-id
  title:    { fr: …, de: …, it: …, en: … }
  subtitle: { fr: …, de: …, it: …, en: … }                # optional
  note:     { fr: …, de: …, it: …, en: … }                # optional method/disclaimer box above the chart
  show_if:  { donor_type: legal }                         # optional: only when the page context matches
  query:                                       # → GET /api/query (whitelist: config/datasets.json)
    dataset: flow | campaign_totals | party_year | mandates
    group_by: [field, …]                       # omit for raw rows
    measure: [sum:value_chf, …]
    filter: { field: value }                   # static filters
    order: -sum_value_chf
    limit: 15
  params: { filter_field: context_key }        # page context → filter; "field:gte" / "field:lte" allowed
  chart:
    type: bars | stacked | columns | dots | table
    label: actor_id            # bars/stacked: category · columns: x
    value: sum_total           # bars/columns/dots: measure
    series: [sum_a, sum_b]     # stacked: one segment per measure
    color: stance | phase | party_id   # optional encoding dimension
    link: actor | donor | financing    # rows link to that entity page
    columns: [..]              # table: columns to show
```

Page context keys: `financing_id`, `phase`, `actor_id`, `donor_id`, `year`, `since` (date one year ago).
