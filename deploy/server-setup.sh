#!/usr/bin/env bash
# Run ON THE SERVER. Idempotent first-time setup of the pipeline: Python deps (pip --user,
# no venv on Infomaniak) and a .env without passwords. Passwords: deploy/set-db-passwords.sh
set -euo pipefail
cd "$(dirname "$0")/.."
pip3 install -q --user --no-warn-script-location httpx PyMySQL PyYAML
if [ ! -f .env ]; then
  cat > .env <<ENV
# Production settings (never commit). Passwords are set with deploy/set-db-passwords.sh
DB_HOST=${DB_HOST:-<account>.myd.infomaniak.com}
DB_PORT=3306
DB_NAME=${DB_NAME:-<prefix>_chpf}
DB_ADMIN_USER=${DB_ADMIN_USER:-<prefix>_admin}
DB_ETL_USER=${DB_ETL_USER:-<prefix>_etl}
DB_API_USER=${DB_API_USER:-<prefix>_api}
API_PORT=${API_PORT:-8787}
SCRAPER_CONTACT=${SCRAPER_CONTACT:-see project repository}
ENV
  chmod 600 .env
  echo ".env created – edit the <account>/<prefix> placeholders, then run deploy/set-db-passwords.sh"
else
  echo ".env already exists – left unchanged"
fi
mkdir -p data/raw data/reports logs
echo "pipeline ready: deploy/pipeline.sh <command>"
