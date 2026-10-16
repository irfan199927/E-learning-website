#!/usr/bin/env bash
# Pull-based auto-deploy: if origin/main has a new commit whose GitHub checks all passed, deploy it.
# Run every few minutes by the systemd timer in deploy/uat/systemd/. Nothing needs to reach into the LAN,
# and only code already merged to main (and green in CI) is ever run here.
set -euo pipefail

# Wrapped in a function: bash then parses the whole file before the checkout below can change it.
main() {
  cd "$(dirname "$0")/../.."
  repo="${GITHUB_REPO:-irfan199927/E-learning-website}"
  state="${UAT_STATE_FILE:-/opt/elearner/deployed-sha}"

  git fetch --quiet origin main
  target="$(git rev-parse origin/main)"
  [[ "$(cat "$state" 2>/dev/null || true)" == "$target" ]] && exit 0

  # Every check run on that commit must have finished successfully (or been skipped).
  runs="$(curl -fsS -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$repo/commits/$target/check-runs?per_page=100")"
  total="$(jq '.check_runs | length' <<< "$runs")"
  pending="$(jq '[.check_runs[] | select(.status != "completed")] | length' <<< "$runs")"
  failed="$(jq '[.check_runs[] | select(.status == "completed" and (.conclusion | IN("success","skipped","neutral") | not))] | length' <<< "$runs")"
  if (( total == 0 || pending > 0 )); then echo "main@${target:0:7}: CI not finished, waiting"; exit 0; fi
  if (( failed > 0 )); then echo "main@${target:0:7}: CI failed, not deploying"; exit 0; fi

  echo "Deploying main@${target:0:7}"
  git checkout --quiet --detach "$target"
  deploy/uat/deploy.sh
  echo "$target" > "$state"
}
main "$@"
