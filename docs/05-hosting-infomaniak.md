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
