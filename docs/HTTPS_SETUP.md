HTTPS setup for Elimusphere

Overview

This document explains how to enable HTTPS for your Elimusphere deployment using nginx and Let's Encrypt (Certbot). The repository includes a helper script and an nginx template:

- scripts/setup-https.sh — convenience script to install nginx/certbot and obtain a certificate (run as sudo).
- deploy/nginx/elimusphere.conf — nginx site template (replace {{DOMAIN}}).

Before you begin

- Ensure your server's DNS A/AAAA records point to the server IP for the domain you want to use.
- You must run the script as root (sudo). It will install packages and write to /etc/nginx.
- Default cert email: info@elimusphere.co.ke. Change by setting the EMAIL env var when running the script.

Quick start (example)

1. Update DNS for your domain (e.g. tusome.example.org) to point to your server.
2. From the project root, run:

```bash
sudo DOMAIN=your.domain.here EMAIL=info@elimusphere.co.ke ./scripts/setup-https.sh
```

3. Confirm nginx is serving your site over HTTPS: open https://your.domain.here

Notes

- The script uses Certbot's nginx plugin to automatically configure SSL. If you self-manage certs, use the proxy example in `deploy/nginx/elimusphere.conf` and point `proxy_pass` to your app (default 127.0.0.1:3000).
- If your app listens on a port other than 3000, update the `proxy_pass` directive in the nginx file accordingly.
- Configure the conferencing provider before launch. See `docs/JITSI_PRODUCTION.md`; production no longer falls back to the public Jitsi demo service.

Troubleshooting

- If Certbot cannot verify the domain, ensure your DNS is correct and port 80/443 are reachable.
- If you use a firewall, open ports 80 and 443:

```bash
sudo ufw allow 80
sudo ufw allow 443
``` 

Security

- Keep your certbot package up to date and ensure automatic renewal is working. Certbot usually installs a systemd timer that renews certificates automatically.
- Use `systemctl status certbot.timer` to verify the renewal job.

If you want, I can:

- Run the script for you (I can't run sudo commands without your permission).
- Prepare a non-root Docker/nginx configuration for TLS termination.
