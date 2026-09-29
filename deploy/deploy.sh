#!/usr/bin/env bash
# Run ON THE SERVER (SSH space, ~/chpf). Updates the PIPELINE copy to production = origin/main.
# The website is a separate Node.js site that pulls main from GitHub itself (docs/05 › Production setup).
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
echo "pipeline updated. Website: redeploy the Node.js site in the Manager if api/ or web/ changed."
