#!/usr/bin/env bash
# Nightly cron entry point. Logs to logs/sync-YYYY-MM.log; exits non-zero on failure so cron's MAILTO reports it.
set -uo pipefail
cd "$(dirname "$0")/.."
log="logs/sync-$(date +%Y-%m).log"
mkdir -p logs
{ echo "=== $(date -Iseconds) ==="; deploy/pipeline.sh sync --trigger cron; } >> "$log" 2>&1
status=$?
[ $status -eq 0 ] || { echo "pipeline sync failed (exit $status) – see ~/chpf/$log"; tail -30 "$log"; }
exit $status
