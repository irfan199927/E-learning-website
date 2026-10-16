#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 / Debian 12 VM for the E-learner UAT. Run as root:
#   curl -fsSL https://raw.githubusercontent.com/irfan199927/E-learning-website/main/deploy/uat/bootstrap-vm.sh -o bootstrap.sh
#   less bootstrap.sh   # read it first
#   sudo bash bootstrap.sh 192.168.1.50      # the VM's LAN IP or hostname
set -euo pipefail
host="${1:?usage: bootstrap-vm.sh <vm-lan-ip-or-hostname>}"
repo_url="${REPO_URL:-https://github.com/irfan199927/E-learning-website.git}"

echo "==> Packages and Docker Engine (official repository)"
apt-get update -q
apt-get install -yq ca-certificates curl git jq openssl
. /etc/os-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Service user and checkout in /opt/elearner"
id elearner >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/elearner --shell /bin/bash elearner
usermod -aG docker elearner
[[ -d /opt/elearner/app/.git ]] || sudo -u elearner git clone --quiet "$repo_url" /opt/elearner/app
[[ -e /opt/elearner/uat.env ]] || sudo -u elearner UAT_ENV_FILE=/opt/elearner/uat.env /opt/elearner/app/deploy/uat/init-env.sh "$host"

echo "==> Auto-update timer"
cp /opt/elearner/app/deploy/uat/systemd/elearner-uat-update.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now elearner-uat-update.timer

echo
echo "Done. The first deploy starts within 2 minutes (builds take ~10 min). Follow it with:"
echo "  journalctl -fu elearner-uat-update"
echo "Then open http://$host and create the first admin (docs/uat.md, 'First users')."
