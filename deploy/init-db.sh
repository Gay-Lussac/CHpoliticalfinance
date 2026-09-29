#!/usr/bin/env bash
# Run ON THE SERVER, interactively, by a human. Applies schema, migrations and views as the
# ADMIN user (so views are owned by admin; see docs/05). Asks for the admin password once.
# Safe to re-run: schema.sql only runs if the tables don't exist yet.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/lib-env.sh; load_env .env
ADMIN_USER="${DB_ADMIN_USER:?set DB_ADMIN_USER in .env}"
read -r -s -p "Password for $ADMIN_USER (input hidden): " MYSQL_PWD; echo
export MYSQL_PWD   # read by the mysql client; not visible in the process list
M="mysql -h $DB_HOST -P ${DB_PORT:-3306} -u $ADMIN_USER $DB_NAME"
if [ -z "$($M -N -e "SHOW TABLES LIKE 'financing'")" ]; then
  $M < db/schema.sql && echo "schema applied"
else
  echo "tables already exist – schema.sql skipped"
fi
for m in db/migrations/*.sql; do $M < "$m"; done && echo "migrations applied"
$M < db/views.sql && echo "views applied"
$M -e "SELECT VERSION() AS server_version, COUNT(*) AS tables_and_views FROM information_schema.tables WHERE table_schema = DATABASE()"
