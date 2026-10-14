# Self-hosted deployment

Elimusphere can run without Cloudflare on a VPS. Node serves the application locally, NGINX terminates HTTPS, and systemd keeps the app running.

## Requirements

- A VPS with Ubuntu/Debian, Node 22+, PostgreSQL, NGINX, and a public IPv4 address.
- A domain whose A/AAAA record points directly to the VPS.
- Ports 80 and 443 open in the VPS firewall.
- A self-hosted Jitsi server at `jitsi.your-domain.example`, or another Jitsi provider configured through the app environment.

## Initial setup

From the project directory on the VPS:

```bash
npm ci
touch .env.local
```

Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `NODE_ENV=production`, and the production Jitsi variables in `.env.local` or `/etc/elimusphere.env`.

For email delivery, set the Resend API key and the verified Elimusphere sender identities:

```text
RESEND_API_KEY=re_...
RESEND_REPLY_TO=info@elimusphere.co.ke
APP_URL=https://elimusphere.co.ke
```

Use the addresses by purpose:

- `onboarding@elimusphere.co.ke` sends welcome, application, and password-reset messages.
- `info@elimusphere.co.ke` sends general account and payment updates, custom lesson schedules and tutor assignments, class assignment notifications, and upcoming-session emails. It is also the public support/reply-to address.
- `admin@elimusphere.co.ke` receives submissions from the public contact form. Replies to those notifications go directly to the submitter.

The application uses the onboarding and updates sender identities directly; no `RESEND_FROM_*` overrides are needed. Set `RESEND_API_KEY` as a production secret and verify the `elimusphere.co.ke` sending domain in Resend, including its required DNS records, before relying on delivery. Keep all three mailboxes or aliases active. Production mail delivery fails explicitly if `RESEND_API_KEY` is missing; development without the key logs mail locally instead of sending it.

Initialize the database:

```bash
npm run db:setup:pg
```

Install the service and enable it:

```bash
sudo cp scripts/elimusphere.service /etc/systemd/system/elimusphere.service
sudo systemctl daemon-reload
sudo systemctl enable --now elimusphere
```

## HTTPS with NGINX

Point `DOMAIN` at the public app domain and run:

```bash
sudo DOMAIN=your-domain.example EMAIL=admin@your-domain.example ./scripts/setup-https.sh
```

The included NGINX configuration proxies the app to `127.0.0.1:8081` and can proxy a self-hosted Jitsi instance on `jitsi.your-domain.example` to `127.0.0.1:8000`.

## Deploy updates

After pulling the latest code:

```bash
npm ci
npm run deploy:self-hosted
sudo systemctl status elimusphere --no-pager
```

The deploy command builds and verifies both bundles before restarting the service. It does not use Cloudflare.

## Troubleshooting

```bash
sudo journalctl -u elimusphere -n 100 --no-pager
sudo nginx -t
sudo systemctl reload nginx
```

If the site loads but meetings fail, confirm `JITSI_DOMAIN` points to the HTTPS Jitsi hostname and that TURN/STUN is configured for users behind NAT.
