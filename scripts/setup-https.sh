#!/usr/bin/env bash
# Usage: sudo DOMAIN=example.com JITSI_DOMAIN=jitsi.example.com ./scripts/setup-https.sh
# This script is a convenience helper to set up nginx + certbot for TLS using Let's Encrypt.
# Replace DOMAIN with your public domain (e.g. tusome.example.org).
# NOTE: This script modifies system configuration and must be run with sudo.

set -euo pipefail
DOMAIN=${DOMAIN:-}
JITSI_DOMAIN=${JITSI_DOMAIN:-}
EMAIL=${EMAIL:-info@elimusphere.co.ke}
NGINX_SITE_DIR=/etc/nginx/sites-available
NGINX_ENABLED_DIR=/etc/nginx/sites-enabled

if [ -z "$DOMAIN" ]; then
  echo "Please set DOMAIN, e.g.: sudo DOMAIN=example.com $0"
  exit 1
fi

if [ -z "$JITSI_DOMAIN" ]; then
  JITSI_DOMAIN="jitsi.$DOMAIN"
fi

echo "Setting up HTTPS for $DOMAIN and $JITSI_DOMAIN using email $EMAIL"

# Install prerequisites (Debian/Ubuntu)
if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx certbot python3-certbot-nginx
fi

# Issue the certificates before replacing the site configuration: the template
# references both certificate files, so NGINX cannot load it until they exist.
certbot certonly --nginx -d "$DOMAIN" --cert-name "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --no-eff-email
certbot certonly --nginx -d "$JITSI_DOMAIN" --cert-name "$JITSI_DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --no-eff-email

# Write nginx site config from template in repo (deploy/nginx/elimusphere.conf)
TEMPLATE="$(pwd)/deploy/nginx/elimusphere.conf"
if [ ! -f "$TEMPLATE" ]; then
  echo "Template $TEMPLATE not found in repo. Create deploy/nginx/elimusphere.conf first."
  exit 1
fi

SITE_CONF="$NGINX_SITE_DIR/$DOMAIN"
cp "$TEMPLATE" "$SITE_CONF"
sed -i "s/{{DOMAIN}}/$DOMAIN/g" "$SITE_CONF"
sed -i "s/{{JITSI_DOMAIN}}/$JITSI_DOMAIN/g" "$SITE_CONF"

ln -sf "$SITE_CONF" "$NGINX_ENABLED_DIR/"

# Test nginx and reload
nginx -t
systemctl reload nginx || systemctl restart nginx

# Enable automatic renewal (certbot usually installs a timer)
systemctl enable --now certbot.timer || true

echo "HTTPS setup complete. Visit https://$DOMAIN and https://$JITSI_DOMAIN to verify."

# Reminder: Update your DNS A/AAAA records to point to this server before running the script.
