#!/usr/bin/env bash
# Run ON THE SERVER. Deploys production = origin/main, nothing else (dev never reaches the server).
# Fast-forward only: refuses if the server copy has local changes or diverged.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin main
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || git checkout -q main
git diff --quiet && git diff --cached --quiet || { echo "local changes on the server – aborting"; exit 1; }
before=$(git rev-parse --short HEAD)
git merge -q --ff-only origin/main
after=$(git rev-parse --short HEAD)
echo "main: $before -> $after"
pip3 install -q --user --no-warn-script-location httpx PyMySQL PyYAML
if command -v npm >/dev/null; then
  npm --prefix api ci --omit=dev --silent
  npm --prefix web ci --silent && npm --prefix web run build --silent
  echo "site built – restart the Node.js site (Manager) to pick up API changes"
else
  echo "npm not found – Node.js site not set up yet; skipped API/web build"
fi
