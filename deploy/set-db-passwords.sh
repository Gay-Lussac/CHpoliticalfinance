#!/usr/bin/env bash
# Run ON THE SERVER, interactively, by a human. Asks for the etl and api DB passwords
# (input hidden) and writes them into .env (chmod 600). Nothing is echoed or logged.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env missing – run deploy/server-setup.sh first"; exit 1; }
set_var() {  # set_var NAME VALUE  (replaces the line, keeps the rest of .env)
  local tmp; tmp=$(mktemp)
  grep -v "^$1=" .env > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  mv "$tmp" .env
}
for var in DB_ETL_PASSWORD DB_API_PASSWORD; do
  read -r -s -p "Password for ${var%_PASSWORD} user (input hidden): " pw; echo
  [ -n "$pw" ] || { echo "empty – aborted"; exit 1; }
  set_var "$var" "$pw"
done
chmod 600 .env
echo "Saved to .env (chmod 600)."
