#!/usr/bin/env bash
# Every 5 minutes (cron): if RPS answers, tell healthchecks.io. No ping for a while → it emails you.
set -euo pipefail
set -a; source "${RPS_APP:-/srv/rps}/.env"; set +a
[ -n "${HC_UPTIME_URL:-}" ] || exit 0
curl -fsS -m 10 "https://$SITE_DOMAIN/healthz" >/dev/null && curl -fsS -m 10 --retry 3 "$HC_UPTIME_URL" >/dev/null
