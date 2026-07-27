Production deployment checklist

- Environment
  - Set `NODE_ENV=production`.
  - Ensure `.env.local` (or environment) contains correct `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

- Database
  - Run Postgres migrations / setup on the production database:
    ```bash
    node scripts/setup-pg.mjs
    ```
  - Ensure backups and monitoring are configured.

- HTTPS / Reverse proxy
  - Terminate TLS at a reverse proxy (NGINX, Cloudflare, load balancer) or host on a platform that provides HTTPS.
  - Example NGINX snippet (proxying to local Node/Vite):
    ```nginx
    server {
      listen 443 ssl;
      server_name example.com;
      ssl_certificate /etc/ssl/certs/fullchain.pem;
      ssl_certificate_key /etc/ssl/private/privkey.pem;

      location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
      }
    }
    ```

- Cookies & Security
  - The app sets `Secure` on session cookies when `NODE_ENV=production` — ensure HTTPS is enabled so browsers accept cookies.
  - Confirm `SameSite=Lax` is acceptable for your login flows; change to `Strict` only if cross-site flows are not needed.
  - Consider adding `HttpOnly`, `Secure`, and an appropriate `Domain` if using subdomains.

- CORS / Proxy
  - Serve the frontend and backend from the same origin when possible to avoid CORS complexity.
  - If using separate origins, ensure every `fetch` that requires cookies uses `credentials: 'include'`.

- Jitsi / Video
  - Use `userInfo` to prefill display name (already implemented).
  - Start with audio/video muted (`startWithAudioMuted`, `startWithVideoMuted`) to reduce permission prompts.
  - If self-hosting Jitsi, ensure TURN/STUN servers are configured for clients behind NAT.

- Monitoring & Logging
  - Route server logs to a log aggregator (Papertrail, Datadog, ELK, etc.).
  - Add health-check endpoints and uptime monitoring.

- CI / Tests
  - Run `npm ci` and `npm run build` in CI.
  - Run integration tests (Playwright):
    ```bash
    npm ci
    npx playwright install
    npm run test:integration
    ```

- Optional
  - Enable rate limiting on auth endpoints.
  - Harden CSP headers and other security headers.
  - Configure session rotation and revocation policies.

If you want, I can prepare Terraform/Ansible snippets or a Docker Compose production example next.
