#!/usr/bin/env bash
# Run ON THE SERVER, interactively, by a human. Creates the visit-statistics tables (db/stats.sql) in the
# separate stats database, as the ADMIN user. Needs STATS_DB_NAME in .env. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/lib-env.sh; load_env .env
ADMIN_USER="${DB_ADMIN_USER:?set DB_ADMIN_USER in .env}"
STATS_DB="${STATS_DB_NAME:?set STATS_DB_NAME in .env (e.g. <prefix>_chpf_stats)}"
read -r -s -p "Password for $ADMIN_USER (input hidden): " MYSQL_PWD; echo
export MYSQL_PWD
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$ADMIN_USER" "$STATS_DB" < db/stats.sql && echo "stats tables ready in $STATS_DB"
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$ADMIN_USER" "$STATS_DB" -e "SHOW TABLES"
