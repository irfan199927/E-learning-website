#!/usr/bin/env bash
# Create the UAT settings file with fresh random secrets. Run once on the VM:
#   deploy/uat/init-env.sh 192.168.1.50            # the VM's LAN IP or hostname
# Writes /opt/elearner/uat.env (override with UAT_ENV_FILE). Never commit that file.
set -euo pipefail
host="${1:?usage: init-env.sh <vm-lan-ip-or-hostname>}"
file="${UAT_ENV_FILE:-/opt/elearner/uat.env}"
if [[ -e "$file" ]]; then echo "$file already exists; not overwriting." >&2; exit 1; fi
mkdir -p "$(dirname "$file")"
rand() { openssl rand -base64 "$1" | tr -d '\n'; }
hex() { openssl rand -hex "$1"; }
umask 077
cat > "$file" <<ENV
# E-learner UAT settings (generated $(date -u +%F)). Keep private: chmod 600.
UAT_HOST=$host
APP_URL=http://$host
WEB_PORT=80
LOG_LEVEL=info

POSTGRES_PASSWORD=$(hex 24)
MINIO_ROOT_PASSWORD=$(hex 24)
BETTER_AUTH_SECRET=$(rand 32)
TOKEN_ENC_KEYS=v1:$(rand 32)
TOKEN_ENC_ACTIVE_KEY_ID=v1

# Google sign-in needs a public HTTPS domain; leave empty on a LAN-only UAT (password sign-in only).
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_WORKSPACE_DOMAIN=

# Mail goes to the UAT inbox (http://$host:8025) unless you set a real SMTP server here.
# SMTP_URL=smtp://user:pass@smtp.example.com:587
MAIL_FROM="E-learner UAT <no-reply@uat.local>"
TRANSCODE_CONCURRENCY=1
ENV
echo "Wrote $file"
