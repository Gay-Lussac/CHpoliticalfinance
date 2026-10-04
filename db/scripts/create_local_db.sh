#!/usr/bin/env bash
# Create the local dev database + users from .env, apply schema.sql (once), migrations and views.sql (always).
# Usage: db/scripts/create_local_db.sh [--reset]   (--reset drops the DB first)
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a
ROOT="mariadb -u ${DB_ROOT_USER:-$USER}"
if [[ "${1:-}" == "--reset" ]]; then $ROOT -e "DROP DATABASE IF EXISTS \`$DB_NAME\`"; fi
$ROOT <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_ETL_USER'@'localhost' IDENTIFIED BY '$DB_ETL_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_ETL_USER'@'127.0.0.1' IDENTIFIED BY '$DB_ETL_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_API_USER'@'localhost' IDENTIFIED BY '$DB_API_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_API_USER'@'127.0.0.1' IDENTIFIED BY '$DB_API_PASSWORD';
-- least privilege (docs/05-hosting-infomaniak.md › Database and users): schema changes are done by the admin user only
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_NAME\`.* TO '$DB_ETL_USER'@'localhost', '$DB_ETL_USER'@'127.0.0.1';
GRANT SELECT ON \`$DB_NAME\`.* TO '$DB_API_USER'@'localhost', '$DB_API_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
if [[ -z "$($ROOT -N -e "SHOW TABLES FROM \`$DB_NAME\` LIKE 'financing'")" ]]; then
  $ROOT "$DB_NAME" < db/schema.sql
  echo "schema applied"
else
  echo "schema already present (use --reset to recreate)"
fi
for m in db/migrations/*.sql; do $ROOT "$DB_NAME" < "$m"; done   # migrations are idempotent
# Visit statistics: separate database, the API user may write there and only there
STATS_DB="${STATS_DB_NAME:-${DB_NAME}_stats}"
$ROOT <<SQL
CREATE DATABASE IF NOT EXISTS \`$STATS_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT SELECT, INSERT, UPDATE ON \`$STATS_DB\`.* TO '$DB_API_USER'@'localhost', '$DB_API_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
$ROOT "$STATS_DB" < db/stats.sql
echo "stats database $STATS_DB ready"
$ROOT "$DB_NAME" < db/views.sql
echo "views applied"
