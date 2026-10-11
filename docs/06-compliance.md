# 06 · Compliance, privacy, accessibility and risk audit (Switzerland)

Audit of 11 October 2026. This is a technical and organisational review, **not legal advice**. No website is
"lawsuit-proof". The aim is to remove avoidable risks and to make the remaining ones defensible: lawful basis,
transparency, accuracy, and a working correction/objection channel.

## Legal frame considered

| Area | Rule | Relevance |
|---|---|---|
| Data protection | Federal Act on Data Protection (nFADP/DSG/LPD, in force since 1.9.2023) | processing of donors' and candidates' names; visitors |
| Political financing | Federal Act on Political Rights, art. 76b ff. (LDP/BPR) | the data are published by the EFK by law |
| Personality rights | Civil Code art. 28 ff. | wrong attribution or misleading presentation of a person |
| Data reuse | opendata.swiss "Open use" (EFK dataset); Swissvotes CC BY 4.0 | licences of the sources |
| Telecom | Telecommunications Act art. 45c | cookies / storage on the visitor's device |
| National symbols | Coat of Arms Protection Act (WSchG) | Swiss cross / flag suggesting an official link |
| Unfair competition | UWG art. 3 | misleading presentation; imprint duties (mainly for e-commerce) |
| Accessibility | BehiG binds federal authorities, not private sites; WCAG 2.1 AA as best practice | inclusive design, low legal exposure |

## Findings and remediation

| # | Finding | Risk | Status |
|---|---|---|---|
| 1 | **Fonts loaded from Google** (`fonts.googleapis.com`): every visit sent the visitor's IP to Google, contradicting the privacy text | high (transparency, transfer abroad) | **fixed**: font self-hosted (`@fontsource-variable/inter`); the built site makes no third-party requests |
| 2 | **API request logs contained visitor IP addresses** (Fastify default request logging) | high (contradicted "no IP stored") | **fixed**: request logging off; errors logged with method + URL only. Verified: no IP in logs |
| 3 | No privacy statement (nFADP art. 19: identity/contact of controller, purposes, recipients, rights) | high | **fixed**: `/privacy` in FR/DE/IT/EN. ⚠ The operator's name/contact must be filled in `config/legal.json` (until then, GitHub issues serve as contact channel) |
| 4 | No legal notice / terms: independence, accuracy disclaimer, liability, licences, governing law | medium | **fixed**: `/legal` in 4 languages; footer states "independent, not affiliated with the EFK/Confederation" |
| 5 | **Swiss-flag favicon/logo** on a site using federal data could suggest an official link (WSchG) | medium | **fixed**: neutral ballot-box logo |
| 6 | No way for a person to object or have their name masked (nFADP art. 30 para. 2 lit. b, art. 32) | high | **fixed**: `config/donor_suppressed.json`. The name, donor page, search entry and alignment are hidden, amounts stay in totals. Procedure documented in the privacy statement |
| 7 | **Alignment of private individuals with party recommendations** derives information close to political opinions (sensitive data, nFADP art. 5) | **highest residual risk** | **mitigated**: method note above the chart ("money, not opinions"), vote counts shown, donor pages `noindex`, objection/masking available. **Recommended:** restrict to legal entities (one line: `fixed_filter` in `config/datasets.json`), or require ≥ 3 votes |
| 8 | Automatic donor grouping may merge homonyms → wrong attribution (personality rights) | medium | **mitigated**: matching on name + first name + municipality for individuals; raw declared spellings shown ("also declared as"); a homonym warning on every donor page; correction channel |
| 9 | Party attribution of organisations is heuristic | low–medium | presented as estimated (About page, chart subtitles); manual overrides in `config/actor_party.yaml` |
| 10 | No security headers | medium | **fixed**: CSP (`'self'` only), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy |
| 11 | No rate limiting (abuse, bulk scraping of names) | medium | **fixed**: 300 API requests/minute per client → 429 |
| 12 | No `robots.txt`; API responses indexable | low–medium | **fixed**: `robots.txt` excludes donor pages, API, stats; `X-Robots-Tag: noindex` on the API |
| 13 | Cookies / device storage (FMG 45c) | low | none for visitors; `localStorage` only holds the operator's stats key on the operator's own browser |
| 14 | Visit statistics | low | aggregate counts only; in-memory daily-salted visitor hash; DNT respected; disclosed in the privacy statement |
| 15 | Licences of sources | low | EFK dataset: opendata.swiss "Open use"; Swissvotes: CC BY 4.0 credited with licence link and "matched and aggregated by us" |
| 16 | Accessibility | low (legal), medium (quality) | **improved**: skip link, visible focus, reduced motion, aria-live search results, muted text contrast raised to ≥ 4.9:1, a data table behind every chart, `lang` per page |
| 17 | Server identifiers in the public repository | low | removed from current files (placeholders); old commits still contain them (no secrets) |
| 18 | Dependencies with known vulnerabilities | medium | `npm audit`: 0 (after the `@fastify/static` upgrade); re-check on each build log |

## Residual risks and operator duties

1. **Fill in `config/legal.json`** (name, contact email; optionally a postal address). The nFADP requires the controller's
   identity and contact in the privacy statement.
2. **Decide on finding 7** (alignment for private individuals). It is the main legal exposure. Restricting it to
   organisations removes most of it.
3. **Answer requests within 30 days** (access, correction, objection). To mask a name, add the donor's match key to
   `config/donor_suppressed.json` and redeploy (Build → Restart).
4. Keep the site **neutral** during campaigns (no editorial positions), and keep the method notes up to date.
5. Have a **lawyer or the FDPIC** look at items 3, 6 and 7 before promoting the site widely.
6. Re-run this audit when adding data sources, features that touch individuals, or third-party services.

## Attack resilience (added 11 October 2026)

| Threat | Protection |
|---|---|
| Flooding / scraping the API | global 300 req/min per client; `/api/search` and `/api/hit` 60/min; login 5 per 15 min. Proxy-aware (per real client IP), so visitors never share a counter |
| Oversized or slow requests | body limit 16 KB, connection timeout 10 s, request timeout 15 s, keep-alive 5 s |
| Expensive queries | whitelisted queries only, answers capped at 1 000 rows, MariaDB `max_statement_time = 5 s` on every API session, DB pool of 8 with a queue limit of 50 |
| SQL injection / XSS | bound parameters and whitelisted identifiers; HTML escaping; strict CSP (`'self'` only) |
| Login brute force / stolen key | **two-factor** stats login (key + TOTP, RFC 6238), single-use codes, constant-time comparisons, 5 attempts per 15 min per client, global lockout after 10 failures, 8-hour signed session in `sessionStorage` (never the key) |
| Leaked secrets | no secrets in the repository or its history (scanned); `.env` git-ignored; GitHub secret scanning and push protection enabled; all keys come from the environment only |
| Database tampering through the site | the site's DB user is read-only on the main DB, write-only to the stats DB |
| Compromised dependency | `npm audit` at 0; recommended: enable Dependabot alerts |

**Operator accounts (outside the code):** turn on 2FA for the **Infomaniak Manager** and **GitHub** accounts. They control
the server, the run command (which holds the DB password) and the production branch. Keep SSH key-only if the Manager allows
disabling password login for the SSH user, otherwise use a long unique password.
