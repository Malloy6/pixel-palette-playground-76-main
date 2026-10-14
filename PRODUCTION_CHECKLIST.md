Production deployment checklist

- Environment
  - Set `NODE_ENV=production` in your service manager or runtime environment, not in `.env.local`.
  - Ensure `.env.local` (or environment) contains correct `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
  - Configure M-Pesa Express production values in the service environment or ignored `.env.local`:
    ```dotenv
    MPESA_ENV=production
    MPESA_CONSUMER_KEY=
    MPESA_CONSUMER_SECRET=
    MPESA_SHORTCODE=1322739
    MPESA_PASSKEY=
    MPESA_PARTY_B=1792746
    MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline
    APP_URL=https://elimusphere.co.ke
    ```
    For the production Merchant Till integration, Safaricom confirmed that
    `1322739` is the Daraja HO/store shortcode and `1792746` is the customer-facing
    Till number. Use `CustomerBuyGoodsOnline`, `BusinessShortCode=1322739`, and
    `PartyB=1792746`. For a PayBill integration, omit `MPESA_PARTY_B` (it defaults
    to the business shortcode) and use `CustomerPayBillOnline`.
    `APP_URL` must be the public HTTPS origin. The callback URL defaults to
    `APP_URL/api/mpesa/callback`; set `MPESA_CALLBACK_URL` only if Safaricom has
    registered a different public HTTPS callback endpoint. Never commit these values.
    The app uses Safaricom's production OAuth and STK Push endpoints. Confirm the
    callback is reachable from the public internet before enabling payments. Use
    a live Daraja app's consumer key/secret and the matching production shortcode,
    passkey, and transaction type; sandbox credentials will not work with the
    production endpoint. The callback must resolve to this app's
    `/api/mpesa/callback` route. If Safaricom accepts a push but it does not reach
    the handset, check the callback/result and the returned Safaricom error
    description in the server logs before changing credentials.
  - If using systemd, load your environment from `.env.local` and run `./scripts/start-prod.sh`.

- Database
  - Run Postgres migrations / setup on the production database:
    ```bash
    node scripts/setup-pg.mjs
    ```
  - Runtime schema setup is versioned: it runs the full migration once per schema version, then uses a short version check on later service starts. The first request after a new schema version may take longer while migrations are applied.
  - The current migration adds grade/subject metadata for resources and learner-targeted tutor assignments. Ensure the production database user can apply the runtime schema migration when the updated app starts.
  - Ensure backups and monitoring are configured.

- HTTPS / Reverse proxy
  - Terminate TLS directly on the VPS with NGINX and Let's Encrypt. Cloudflare is optional and is not required.
  - Build and verify the client and SSR bundles together before restarting the service. For in-place deployments, keep prior fingerprinted files in `dist/client/assets` so already-open pages can still load them; do not copy only `dist/server` or replace the assets directory wholesale:
    ```bash
    npm ci
    npm run build:production
    sudo systemctl restart elimusphere
    ```
  - The supplied `scripts/elimusphere.service` is configured for this server's `kif3` deployment user and `/home/kif3/pixel-palette-playground-76-main` directory. If your production user or checkout directory differs, update all three paths (`User`, `WorkingDirectory`, `ExecStart`) before installing it.
  - If NGINX returns `502 Bad Gateway`, inspect the app process rather than the frontend:
    ```bash
    sudo systemctl status elimusphere --no-pager
    sudo journalctl -u elimusphere -n 100 --no-pager
    ```
  - Example NGINX snippet (proxying to local Node/Vite):
    ```nginx
    server {
      listen 80;
      server_name elimusphere.co.ke www.elimusphere.co.ke;
      return 301 https://$host$request_uri;
    }

    server {
      listen 443 ssl;
      server_name elimusphere.co.ke www.elimusphere.co.ke;
      ssl_certificate /etc/ssl/certs/fullchain.pem;
      ssl_certificate_key /etc/ssl/private/privkey.pem;

      # Do not use `try_files $uri /index.html` for Vite's hashed assets.
      # It turns a missing .css/.js file into HTML, which breaks the page styling.
      location ^~ /assets/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
      }

      location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
      }
    }
    ```
  - Reload NGINX after changing its configuration: `sudo nginx -t && sudo systemctl reload nginx`.

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
  - If clients report `conference.videobridgeNotAvailable`, the web and XMPP
    endpoints may still load while Jicofo has no usable Jitsi Videobridge (JVB).
    Check the active Compose project before changing app or whiteboard settings:
    ```bash
    cd /opt/jitsi-meet
    sudo docker-compose -f docker-compose.yml -f whiteboard.yml ps prosody jicofo jvb
    sudo docker-compose -f docker-compose.yml -f whiteboard.yml logs --tail=200 jicofo jvb
    sudo ss -lunp | grep ':10000'
    ```
    Restore the JVB service and its configured public/NAT address and UDP media
    port first; the later P2P `Not connected` and Jitsi reload messages are
    consequences of the failed conference allocation. STUN/TURN `extdisco`
    warnings indicate missing relay credentials and can impair connections
    behind restrictive NATs, but they do not explain Jicofo reporting that no
    Videobridge is available.
  - Jitsi whiteboards need the Excalidraw collaboration backend in addition to
    `whiteboard.enabled`. The production Jitsi `config.js` must set
    `whiteboard.collabServerBaseUrl` to a browser-reachable HTTPS URL. For this
    deployment it is `https://jitsi.elimusphere.co.ke`; Nginx must proxy
    `/socket.io/` to the backend and the backend `CORS_ORIGIN` must match
    `https://jitsi.elimusphere.co.ke`.
    The app also passes this URL in the Jitsi iframe configuration; set
    `JITSI_WHITEBOARD_URL` in the app environment if the backend uses a
    different HTTPS origin.     The tutor opens the room's shared board; application state synchronizes
    visibility to participants and closes their board when the tutor hides it.
    Each new class session uses a fresh Jitsi room name to avoid reusing a
    previous session's whiteboard. Keep Jitsi's whiteboard `userLimit` above
    the expected number of learners; it limits viewers as well as editors.
  - The custom backend image is built from the pinned upstream commit in
    `deploy/jitsi/Dockerfile.whiteboard`. It keeps the backend's Socket.IO
    metrics while disabling `prom-client`'s Node event-loop delay histogram,
    which crashes the VPS's Node runtime. Build it on the VPS to use the
    current Node 22 base image:
    ```bash
    cd /home/kif3/pixel-palette-playground-76-main
    sudo docker build --pull --no-cache \
      -f deploy/jitsi/Dockerfile.whiteboard \
      -t elimusphere/excalidraw-backend:2026.3.0-node22 \
      deploy/jitsi
    ```
  - The backend container and matching Nginx location are in
    `deploy/jitsi/docker-compose.override.yml` and
    `deploy/nginx/elimusphere.conf`. Merge the Jitsi override with the active
    Jitsi Compose project. Remove only the old, exited whiteboard container
    (do not remove volumes or other Jitsi services), then start the service:
    ```bash
    cd /opt/jitsi-meet
    sudo docker rm -f 1ae1199cca59_jitsi-meet_whiteboard_1
    sudo docker-compose -f docker-compose.yml -f whiteboard.yml \
      -f /home/kif3/pixel-palette-playground-76-main/deploy/jitsi/docker-compose.override.yml \
      config -q
    sudo docker-compose -f docker-compose.yml -f whiteboard.yml \
      -f /home/kif3/pixel-palette-playground-76-main/deploy/jitsi/docker-compose.override.yml \
      up -d --no-deps whiteboard
    ```
    Do not type angle-bracket placeholders into Bash. In
    `/etc/nginx/sites-available/elimusphere.co.ke`, add the `/socket.io/`
    location from `deploy/nginx/elimusphere.conf` inside the HTTPS
    `jitsi.elimusphere.co.ke` server block, before its general `/` location,
    using this exact block, then run `sudo nginx -t && sudo systemctl reload nginx`:
    ```nginx
    location ^~ /socket.io/ {
      proxy_pass http://127.0.0.1:3002;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 120s;
      proxy_send_timeout 120s;
      proxy_buffering off;
    }
    ```
    Verify `curl -fsS http://127.0.0.1:3002/` responds with
    `Excalidraw backend is up :)`, then confirm the public Socket.IO WebSocket
    handshake succeeds with HTTP 101. Never expose backend port 3002 directly
    to the public internet.

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
