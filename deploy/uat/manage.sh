#!/usr/bin/env bash
# Day-to-day UAT tasks on the VM. Run as the elearner user from /opt/elearner/app:
#   deploy/uat/manage.sh create-user teacher@example.com "Meera Kulkarni" TEACHER
#   deploy/uat/manage.sh set-role someone@example.com ADMIN
#   deploy/uat/manage.sh demo-data          # the demo accounts and course from the seed (password Password123!)
#   deploy/uat/manage.sh logs [web|worker]  # follow logs
#   deploy/uat/manage.sh backup             # database dump to /opt/elearner/backups
#   deploy/uat/manage.sh status
set -euo pipefail
cd "$(dirname "$0")/../.."
env_file="${UAT_ENV_FILE:-/opt/elearner/uat.env}"
# UAT_COMPOSE_OVERRIDE: optional extra Compose file (e.g. a Cloudflare tunnel service) merged on top.
dc() { docker compose --env-file "$env_file" -f deploy/uat/compose.yaml ${UAT_COMPOSE_OVERRIDE:+-f "$UAT_COMPOSE_OVERRIDE"} "$@"; }
tools() { dc --profile tools run --rm tools "$@"; }

cmd="${1:-help}"; shift || true
case "$cmd" in
  create-user) tools pnpm db:create-user -- "$@" ;;
  set-role) tools pnpm db:set-role -- "$@" ;;
  demo-data) tools pnpm db:seed ;;
  logs) dc logs -f --tail=200 "${@:-web}" ;;
  status) dc ps ;;
  backup)
    dir="${BACKUP_DIR:-/opt/elearner/backups}"; mkdir -p "$dir"
    out="$dir/elearner-$(date +%F-%H%M).sql.gz"
    dc exec -T postgres pg_dump -U elearner --clean --if-exists elearner | gzip > "$out"
    echo "Wrote $out"
    ;;
  *) sed -n '2,9p' "$0" ;;
esac
