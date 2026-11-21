#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for RPS. Run as root on the server:
#   sudo bash server-setup.sh rps.example.in
# Safe to run again: it keeps an existing /srv/rps/.env and its secrets.
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then echo "usage: sudo bash server-setup.sh <site domain>" >&2; exit 1; fi
if [ "$(id -u)" != 0 ]; then echo "run as root (sudo)" >&2; exit 1; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP=/srv/rps

echo "==> System updates and tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq docker.io docker-compose-v2 ufw fail2ban unattended-upgrades curl openssl

echo "==> Security updates install by themselves; reboot at 03:30 IST when one needs it"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat > /etc/apt/apt.conf.d/52rps-unattended <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "22:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
CONF

echo "==> Firewall: only SSH and the website"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> SSH: key files only, no root login"
cat > /etc/ssh/sshd_config.d/60-rps.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
systemctl reload ssh || systemctl reload sshd
systemctl enable --now fail2ban

echo "==> Swap (2 GB) so a memory peak slows the server instead of stopping it"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Docker: start on boot, keep logs small"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'CONF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
CONF
systemctl enable docker
systemctl restart docker

echo "==> App folder $APP"
mkdir -p "$APP/uploads/rework" "$APP/backups" "$APP/secrets"
chown -R 10001:10001 "$APP/uploads"   # the backend runs as uid 10001
chmod 700 "$APP/backups"
chown 10001:10001 "$APP/secrets"       # only the backend may read the keys in here (Firebase)
chmod 700 "$APP/secrets"
for f in compose.yml Caddyfile backup.sh restore.sh uptime.sh; do
  install -m 0644 "$HERE/$f" "$APP/$f"
done
chmod 0755 "$APP"/*.sh

if [ ! -f "$APP/.env" ]; then
  echo "==> New secrets (made here, never leave the server)"
  secret() { openssl rand -hex 32; }
  sed -e "s|^SITE_DOMAIN=.*|SITE_DOMAIN=$DOMAIN|" \
      -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(secret)|" \
      -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(secret)|" \
      -e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(secret)|" \
      -e "s|^FILE_URL_SECRET=.*|FILE_URL_SECRET=$(secret)|" \
      "$HERE/env.example" > "$APP/.env"
else
  echo "==> Keeping the existing $APP/.env"
  sed -i "s|^SITE_DOMAIN=.*|SITE_DOMAIN=$DOMAIN|" "$APP/.env"
fi
chmod 600 "$APP/.env"

echo "==> Nightly backup (03:00 IST) and a health ping every 5 minutes"
cat > /etc/cron.d/rps <<'CONF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 21 * * * root /srv/rps/backup.sh >> /var/log/rps-backup.log 2>&1
*/5 * * * * root /srv/rps/uptime.sh >/dev/null 2>&1
CONF
chmod 644 /etc/cron.d/rps

echo
echo "✓ Server ready. Next: from your laptop, run deploy/ship.sh (see the deploy runbook)."
