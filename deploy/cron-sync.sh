#!/usr/bin/env bash
# Nightly cron entry point. Logs to logs/sync-YYYY-MM.log; exits non-zero on failure so cron's MAILTO reports it.
set -uo pipefail
cd "$(dirname "$0")/.."
log="logs/sync-$(date +%Y-%m).log"
mkdir -p logs
{ echo "=== $(date -Iseconds) ==="; deploy/pipeline.sh sync --trigger cron; } >> "$log" 2>&1
status=$?
[ $status -eq 0 ] || { echo "pipeline sync failed (exit $status) – see ~/chpf/$log"; tail -30 "$log"; }
# Housekeeping: keep 12 months of logs and 6 months of run reports (runs are also in the fetch_run table).
# The raw archive (data/raw) is never pruned: it is the source for `pipeline rebuild`.
find logs -name 'sync-*.log' -mtime +365 -delete 2>/dev/null
find data/reports -name 'run-*.md' -mtime +180 -delete 2>/dev/null
exit $status
