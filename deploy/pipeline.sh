#!/usr/bin/env bash
# Run the pipeline on the server without a venv (deps installed with pip --user).
# Usage: deploy/pipeline.sh sync | rebuild | check | discover | resolve --review
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONPATH="$PWD/pipeline${PYTHONPATH:+:$PYTHONPATH}"
exec python3 -m chpf.cli "$@"
