# Self-Hosted Jitsi Migration Guide

This guide explains how to migrate from JaaS (8x8) to a self-hosted Jitsi server for unlimited concurrent sessions.

## Architecture Benefits

- **Unlimited Sessions**: No per-session limits from JaaS
- **Cost Control**: Pay only for infrastructure (VPS), not per session
- **Data Sovereignty**: All video data stays on your infrastructure
- **Full Control**: Customize Jitsi features and settings
- **No Breaking Changes**: Current app code already supports self-hosted instances

## Prerequisites

- VPS with 4+ CPU cores, 8+ GB RAM, 50+ GB storage (for production)
- Docker and Docker Compose installed
- DNS entry for your Jitsi domain (e.g., `jitsi.yourdomain.com`)
- SSL certificate (Let's Encrypt recommended)

## Deployment Steps

### 1. Prepare Your VPS

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $(whoami)

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clone Jitsi Meet Docker Repository

```bash
cd /opt
sudo git clone https://github.com/jitsi/docker-jitsi-meet.git
cd docker-jitsi-meet
```

### 3. Configure Environment

```bash
# Create .env file from template
cp env.example .env

# Edit .env with your settings
sudo nano .env
```

**Key environment variables to set:**

```ini
# Domain where Jitsi will be accessible
JITSI_DOMAIN=jitsi.yourdomain.com

# Browser-reachable Excalidraw collaboration endpoint (usually the same host)
JITSI_WHITEBOARD_URL=https://jitsi.yourdomain.com

# HTTPS settings
ENABLE_LETSENCRYPT=1
LETSENCRYPT_DOMAIN=jitsi.yourdomain.com

# Enable the built-in collaborative whiteboard
ENABLE_WHITEBOARD=1

# Optional: Disable JWT requirement for simple deployments
# (recommended for initial testing)
ENABLE_JWT=0

# Optional: If using JWT, configure the secret
JWT_ISSUER=your-app-name
JWT_SECRET=generate-a-long-random-string-here
JWT_AUDIENCE=your-app-name

# Video quality settings
JITSI_VIDEOBRIDGE_MEMORY=2G

# XMPP settings
XMPP_DOMAIN=meet.jitsi
XMPP_SERVER=xmpp.meet.jitsi
XMPP_MUC=muc.meet.jitsi
```

For a self-hosted Jitsi domain, the app uses `https://JITSI_DOMAIN` for
`whiteboard.collabServerBaseUrl` by default. Set `JITSI_WHITEBOARD_URL` when the
Excalidraw backend is served from a different HTTPS origin. The tutor opens the
room's single shared whiteboard; learners automatically open and focus that
same board when it appears. Whiteboard visibility is synchronized through the
application room state so a tutor hiding the board closes it for learners too.
Each newly started lesson session receives a unique Jitsi room name, preventing
the whiteboard from a previous session from reappearing. Do not set Jitsi's
whiteboard `userLimit` to `1`: that setting limits board participants,
including learners who only need to view the tutor's work.

### 4. Configure Firewall and DNS

```bash
# Open required ports (adjust for your firewall)
sudo ufw allow 80/tcp     # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 10000/udp  # Jitsi UDP

# Add DNS record
# Create A record: jitsi.yourdomain.com -> your-vps-ip
```

### 5. Deploy Jitsi with Docker Compose

```bash
# Create persistent data directories
mkdir -p ~/.jitsi-meet-cfg/{web/letsencrypt,storage/{web,prosody,transcripts},prosody/certs,jicofo,jvb}

# Nginx owns ports 80 and 443 on this server. Keep Jitsi behind Nginx:
# HTTP_PORT=8000, HTTPS_PORT=8443, ENABLE_LETSENCRYPT=0
# Configure deploy/nginx/elimusphere.conf for jitsi.yourdomain.com.

# Start services
sudo docker-compose up -d

# Verify services are running
sudo docker-compose ps
```

### 6. Verify Deployment

```bash
# Check the internal Jitsi web endpoint before DNS and certificate issuance
curl -I http://127.0.0.1:8000

# After DNS and the Nginx certificate are ready, check the public endpoint
curl -I https://jitsi.yourdomain.com

# View logs for any errors
sudo docker-compose logs -f jitsi-web

# Test a conference room in browser
# Visit: https://jitsi.yourdomain.com/test-room
```

## Application Configuration

### Update Elimusphere Environment Variables

Replace your current JaaS configuration with:

```ini
# Remove these (or keep as fallback):
# JITSI_APP_ID=...
# JITSI_KEY_ID=...
# JITSI_PRIVATE_KEY=...

# Add these for self-hosted:
JITSI_DOMAIN=jitsi.yourdomain.com

# Optional: If you enabled JWT in Jitsi
# JITSI_JWT_ISSUER=your-app-name
# JITSI_JWT_SECRET=generate-a-long-random-string-here
# JITSI_JWT_AUDIENCE=your-app-name
```

### VPS Deployment (systemd service)

Update `/etc/elimusphere.env`:

```ini
JITSI_DOMAIN=jitsi.yourdomain.com
# Remove JITSI_APP_ID, JITSI_KEY_ID, JITSI_PRIVATE_KEY_FILE
```

Then restart the app:

```bash
sudo systemctl restart elimusphere
sudo systemctl status elimusphere --no-pager
```

## Optional: Enable JWT Authentication

For production, you may want to require JWT authentication to prevent unauthorized room access.

### Step 1: Update Jitsi Configuration

In your docker-compose.yml, set:

```yaml
environment:
  ENABLE_JWT: 1
  JWT_ISSUER: elimusphere
  JWT_SECRET: your-secret-key-min-32-chars
  JWT_AUDIENCE: elimusphere
```

### Step 2: Update Elimusphere

Create JWT tokens server-side before participants join:

```typescript
// In tusome-db.ts, add self-hosted JWT creator
function createSelfHostedJwt({
  secret,
  roomName,
  userName,
  userId,
  role,
}: {
  secret: string;
  roomName: string;
  userName: string;
  userId: number;
  role: string;
}) {
  const payload = {
    aud: "elimusphere",
    iss: "elimusphere",
    sub: "elimusphere",
    room: roomName,
    name: userName,
    email: `user-${userId}@elimusphere.internal`,
    "https://jitsi.org/user_id": `user-${userId}`,
    "https://jitsi.org/features": {
      livestream: false,
      transcription: false,
      recording: role === "tutor",
    },
  };
  
  // Use jsonwebtoken library to sign
  return jwt.sign(payload, secret, { expiresIn: "4h" });
}
```

## Monitoring

### Disk Space

```bash
# Monitor disk usage
df -h

# Clean up old docker images and logs if needed
sudo docker system prune -a
```

### Service Health

```bash
# Check Jitsi videobridge (handles connections)
sudo docker-compose logs jitsi-videobridge | tail -20

# Monitor CPU/Memory
sudo docker stats
```

### Scaling for More Users

If experiencing performance issues:

1. **Increase Bridge Memory**: In `.env`, increase `JITSI_VIDEOBRIDGE_MEMORY`
2. **Add Videobridge Replicas**: Scale JVB instances horizontally
3. **Use Multiple VPS**: Deploy Jitsi on separate servers with load balancing

## Troubleshooting

### "Could not load the video service"

1. Check JITSI_DOMAIN is correct and resolves to your VPS IP
2. Verify HTTPS is working: `curl -I https://jitsi.yourdomain.com`
3. Check firewall allows ports 80, 443, and 10000/UDP
4. Review browser console for CORS or SSL errors

### High Latency or Video Stuttering

1. Check server CPU and memory usage: `docker stats`
2. Increase video bridge memory in `.env`
3. Reduce video quality settings in Jitsi config
4. Check network bandwidth availability

### Participants Can't Hear Each Other

1. Verify WebRTC candidate gathering: Check browser's "chrome://webrtc-internals"
2. Ensure port 10000/UDP is open
3. Check STUN server configuration in Jitsi

## Rollback to JaaS (if needed)

If you need to revert to JaaS:

```bash
# Update environment to JaaS config
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=vpaas-magic-cookie-...
JITSI_KEY_ID=vpaas-magic-cookie-.../...
JITSI_PRIVATE_KEY=<your-private-key>

# Restart app
sudo systemctl restart elimusphere
```

The application code automatically detects and uses the appropriate configuration.

## Performance Benchmarks

- **Single VPS Setup**: ~50-100 concurrent participants
- **Multi-Bridge Setup**: Scales linearly with added hardware
- **Network Requirements**: 2.5 Mbps per participant (audio+video)

## Support and Updates

- Check Jitsi documentation: https://jitsi.github.io/handbook/
- Monitor Docker image updates: `docker-compose pull`
- Subscribe to security notifications for Jitsi and dependencies
