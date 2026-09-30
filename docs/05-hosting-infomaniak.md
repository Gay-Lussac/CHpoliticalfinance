# 05 · Hosting on Infomaniak

Infomaniak's offers differ a lot in what they can run. **Phase 0 must verify the actual plan** before the stack is frozen.
The items below are the points to check, and each one is a decision input.

## Checklist (fill in during phase 0)

| Question | Why it matters | Answer |
|---|---|---|
| Which product? (Web hosting / Cloud Server / VPS / Jelastic) | defines everything below | |
| MariaDB/MySQL version and number of DBs | schema uses views and JSON; needs MariaDB ≥ 10.6 or MySQL ≥ 8 | |
| Remote DB access allowed (IP allow-list)? | lets the pipeline run from GitHub Actions if needed | |
| SSH access? Python 3.11+ available? `pip install --user` works? | pipeline runs on the host | |
| Cron / scheduled tasks can run a shell command (not only an URL)? | daily sync | |
| Node.js app hosting available on this plan? Version? | API choice (Node vs PHP) | |
| PHP version | fallback API | |
| Disk quota | raw archive grows by ~tens of MB/year (xlsx + JSON, 3 languages) | |
| Custom domain + free TLS (Let's Encrypt) | | |
| Backups: DB snapshot frequency and retention | we still keep the raw archive as a rebuild source | |

## Target deployment (if web hosting + Node or PHP + SSH + cron)

```
domain.ch/            → static front-end (web/dist)
domain.ch/api/        → API (Node app or PHP)
cron 03:15 daily      → ~/app/pipeline/.venv/bin/pipeline sync  (log + mail on failure)
MariaDB               → one DB, two users: `etl` (read/write) and `api` (SELECT only on views + label tables)
~/app/data/raw/       → raw archive (also synced to a private git repo or object storage for safety)
```

## Fallback (no Python on the host)

- A GitHub Actions schedule runs `pipeline sync` with the raw archive stored as a repo or release artefact, and writes to MariaDB over
  remote access. If remote access is refused, it uploads the SQL dump via SSH and a cron job imports it.

## Environments

- `local`: MariaDB in Docker (or Homebrew) with the same schema. Create `.env` from `.env.example`.
- `prod`: Infomaniak.
- No staging at first. The pipeline's `check` step, together with the fact that the website only reads, keeps risk low.

## Database and users (least privilege)

The browser never talks to the database. Only the Node API does, so the "front end" user is really the API user.
All data is public, so the main risks are **tampering** (someone altering amounts) and **loss**, not leaks.
The setup is built against those:

| User | Rights | Used by | Where the password lives |
|---|---|---|---|
| `chpf_admin` | everything on `chpf` (CREATE, ALTER, DROP, CREATE VIEW, …) | **you**, by hand, for `schema.sql`, migrations and `views.sql` | password manager only; not on disk |
| `chpf_etl` | `SELECT, INSERT, UPDATE, DELETE` on `chpf` | the nightly `pipeline sync` | server `.env` (chmod 600) |
| `chpf_api` | `SELECT` on `chpf` | the Node API | server `.env` (chmod 600) |

Tested locally: a full `pipeline rebuild` works with the `chpf_etl` rights above. `chpf_api` is refused any write, and
`chpf_etl` is refused `DROP`/`ALTER`. Even if the API were fully compromised, it could not change a single amount. A bug
in the pipeline could corrupt data but not the schema, and `pipeline rebuild` from the raw archive repairs the data.

Rules:
- **Three different long random passwords** (e.g. `openssl rand -base64 24`). No reuse, and never in git, chat or tickets.
- **No remote access.** Leave external or remote access to the database disabled in the Manager. The API and the
  pipeline run on the same server. For a one-off look from your Mac, use an SSH tunnel (`ssh -L 3307:<db-host>:3306 …`).
- `.env` on the server: `chmod 600 .env`, owned by the account the app runs as, outside the public web root.
- **Views are created by `chpf_admin`.** MariaDB views run with their creator's rights (SQL SECURITY DEFINER), which is why
  `chpf_api` can read them with SELECT only. Don't delete `chpf_admin`, or the views stop working.
- **Backups.** Infomaniak's automatic DB backups, plus the raw archive (`data/raw`), which can rebuild everything. Also take a
  `mysqldump` with the admin user before any migration.
- **Application side** (already in place): the API only runs whitelisted queries with bound parameters and a connection
  cap of 8. Add rate limiting in front of it before launch (roadmap phase 3).

Setup order on Infomaniak:
1. Manager → Databases: create the database. Infomaniak prefixes names with your account prefix, e.g. `abc12_chpf`;
   use that exact name as `DB_NAME`, and the same for user names.
2. Create the 3 users, and in each user's permissions on this database give: admin = all/administration,
   etl = read + write (data), api = read only. If the Manager's choices are coarser than this, give the etl user
   read/write and don't give it structure (DDL) rights if the Manager lets you separate them.
3. Over SSH, as `chpf_admin`: apply `db/schema.sql`, `db/migrations/*.sql`, then `db/views.sql`.
4. Put the etl and api credentials in the server `.env`, then run `pipeline sync --full --trigger backfill` once.

## Production setup (as deployed, 2026-09-29)

Infomaniak Managed Cloud Server. Two **isolated** hosting spaces share one MariaDB (10.11).
Account-specific names are shown as `<account>` / `<prefix>`; the real values are kept outside the repository.

| Part | Where | Code | Runs |
|---|---|---|---|
| Website + API | Node.js site `polimoney.ch` (container, `/srv/customer/sites/polimoney.ch`) | git clone of GitHub `main`, updated **by the build command** | build: `git fetch origin main && git reset --hard origin/main && npm --prefix api ci --omit=dev && npm --prefix web ci && npm --prefix web run build && rm -rf web/node_modules` · run: `API_HOST=0.0.0.0 … node api/src/server.js` · port 8787 |
| Pipeline | SSH space `<ssh-user>@<account>.ftp.infomaniak.com`, `~/chpf` | `git clone` of `main`, updated with `deploy/deploy.sh` | Python 3.9 with `pip --user` (no venv available); crontab `15 3 * * *` → `deploy/cron-sync.sh`, emails only on failure |
| Database | `<account>.myd.infomaniak.com` · `<prefix>_chpf` | schema via `deploy/init-db.sh` (admin) | users `<prefix>_admin` (schema), `<prefix>_etl` (pipeline), `<prefix>_api` (site) |

Keeping each side minimal:
- **Website:** the whole repo is pulled, but only `web/dist` and the API are served. Every other path returns the SPA page
  (checked: `/.env`, `/.git/config`, `/pipeline/…` do not leak). After the build, `web/node_modules` (build tools, ~54 MB)
  is removed. Only `api/node_modules` (production dependencies) stays.
- **Pipeline space:** `git sparse-checkout set pipeline config db deploy`, so only what the pipeline uses is checked out
  (plus root files). `deploy/deploy.sh` keeps working as usual. `cron-sync.sh` prunes logs after 12 months and reports
  after 6 months. `data/raw` is never pruned.

Things learned while deploying:
- The Node site runs in a container and must listen on `0.0.0.0` (`API_HOST`), or the proxy shows "Website under maintenance".
- The site has no `.env`; DB settings are given as environment variables in the site configuration.
- Hosted MariaDB closes idle connections, so the pipeline loads on a fresh connection after its download phase.
- `.env` files are read literally (`deploy/lib-env.sh`), because passwords may contain `$`, quotes or spaces.

Releasing: merge a PR `dev → main`, then **(1)** in the Manager, Node.js site: **Build** (the build command pulls `main`),
then **Restart**, if `api/`, `web/` or `config/` changed. The Manager has no separate "pull" button, and Restart alone
reruns the old code. Then
and **(2)** run `ssh <ssh-user>@<account>.ftp.infomaniak.com 'cd ~/chpf && deploy/deploy.sh'` if `pipeline/`, `config/` or `db/` changed.
Schema changes (`db/migrations`, `db/views.sql`) are applied with `deploy/init-db.sh` (asks for the admin password).

## Visit statistics (built in, no third party)

- **What is stored:** daily totals per page, per language, and per external referring site, in a **separate database**
  (`<prefix>_chpf_stats`, tables in `db/stats.sql`). Never stored: IP addresses, user agents, cookies.
- **Unique visitors:** a hash of IP + user agent with a random salt that changes every day. It exists **in memory only**,
  and only the daily count is saved. Bots and browsers sending `DNT: 1` are not counted. More than 60 page views per
  minute from one client are ignored.
- **Least privilege:** the website's DB user has read+write on the stats database only; the main database stays read-only.
  If the stats DB is missing, counting switches itself off and the site keeps working.
- **Viewing:** `https://polimoney.ch/<lang>/stats` (not linked anywhere) asks for the `STATS_TOKEN` key. The browser
  remembers it locally until you click "forget". Without `STATS_TOKEN` the stats endpoint is disabled.

Setup on Infomaniak (once):
1. Manager → Databases: create a database `chpf_stats` (it becomes `<prefix>_chpf_stats`). Give the **api** user
   **read + write on this database only**, and the **admin** user full rights.
2. Add `STATS_DB_NAME=<prefix>_chpf_stats` to `~/chpf/.env` in the SSH space, then run `deploy/init-stats-db.sh`
   (asks for the admin password).
3. Node.js site, run command: add `STATS_DB_NAME=<prefix>_chpf_stats STATS_TOKEN='<long random key>'` before `node …`.
   Generate the key with `openssl rand -hex 24` and keep it in your password manager.
4. Build → Restart. Then open `/fr/stats` and enter the key.
