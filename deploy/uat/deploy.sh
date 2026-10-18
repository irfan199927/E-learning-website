#!/usr/bin/env bash
# Build and (re)start the UAT stack from the current checkout, applying migrations first.
# Safe to re-run. Usage (from anywhere in the repo):  deploy/uat/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
env_file="${UAT_ENV_FILE:-/opt/elearner/uat.env}"
[[ -r "$env_file" ]] || { echo "Missing $env_file. Run deploy/uat/init-env.sh first." >&2; exit 1; }
export GIT_SHA; GIT_SHA="$(git rev-parse --short HEAD)"
# UAT_COMPOSE_OVERRIDE: optional extra Compose file (e.g. a Cloudflare tunnel service) merged on top.
dc() { docker compose --env-file "$env_file" -f deploy/uat/compose.yaml ${UAT_COMPOSE_OVERRIDE:+-f "$UAT_COMPOSE_OVERRIDE"} "$@"; }
port="$(grep -E '^WEB_PORT=' "$env_file" | cut -d= -f2)"; port="${port:-80}"

grep -qE '^MAILPIT_UI_AUTH=.+' "$env_file" ||
  echo "WARNING: MAILPIT_UI_AUTH is not set in $env_file: the mail inbox on :8025 (reset links) is open to the LAN." >&2

echo "==> Building images for $GIT_SHA"
dc --profile tools build
echo "==> Starting data services"
dc up -d --wait postgres redis
dc up -d minio mailpit
dc up minio-init --exit-code-from minio-init
echo "==> Applying database migrations"
dc --profile tools run --rm tools pnpm db:deploy
echo "==> Starting web and worker"
dc up -d --wait web worker

echo "==> Checking readiness"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$port/api/health/ready" > /dev/null; then
    echo "UAT is up: $(grep -E '^APP_URL=' "$env_file" | cut -d= -f2) (version $GIT_SHA)"
    docker image prune -f > /dev/null
    exit 0
  fi
  sleep 2
done
echo "Readiness check failed. Logs: docker compose -f deploy/uat/compose.yaml logs web" >&2
exit 1
