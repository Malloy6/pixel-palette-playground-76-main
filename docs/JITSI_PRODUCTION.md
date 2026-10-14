# Production Jitsi configuration

Elimusphere supports two production deployment options for video conferencing:

1. **JaaS (8x8)** — Managed service with automatic scaling (deprecated, expensive)
2. **Self-Hosted Jitsi** — Full control, unlimited sessions, cost-effective (recommended)

Both use deterministic lesson-based room names: `elimusphere-lesson-{lessonId}`. The server generates authentication tokens server-side for every participant when they join.

Tutors and admins receive `moderator=true`; learners receive `moderator=false`.

## Option 1: Self-Hosted Jitsi (Recommended)

For production deployments, self-hosting provides:
- Unlimited concurrent sessions at fixed cost
- Full data sovereignty and control
- Custom branding and features
- No per-session licensing fees

### Configuration

```text
JITSI_DOMAIN=jitsi.yourdomain.com
NODE_ENV=production
```

The app automatically operates without JWT for basic self-hosted setups. For additional security with JWT:

```text
JITSI_DOMAIN=jitsi.yourdomain.com
JITSI_JWT_ISSUER=your-app-name
JITSI_JWT_SECRET=your-secret-key
NODE_ENV=production
```

See [JITSI_SELF_HOSTED.md](./JITSI_SELF_HOSTED.md) for complete deployment guide.

## Option 2: JaaS (8x8) - Legacy/Fallback

For existing JaaS deployments or if self-hosting is not feasible:

```text
JITSI_APP_ID=vpaas-magic-cookie-your-app-id
JITSI_KEY_ID=vpaas-magic-cookie-your-app-id/your-key-id
JITSI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
JITSI_DOMAIN=8x8.vc
NODE_ENV=production
```

## VPS Deployment Steps (Self-Hosted)

1. Deploy Jitsi on a dedicated VPS (see [JITSI_SELF_HOSTED.md](./JITSI_SELF_HOSTED.md))
2. Configure environment variables in `/etc/elimusphere.env`:
   ```bash
   sudo install -m 600 -o root -g root /dev/null /etc/elimusphere.env
   sudoedit /etc/elimusphere.env
   # Add: JITSI_DOMAIN=jitsi.yourdomain.com
   ```
3. Restart the app:
   ```bash
   sudo systemctl restart elimusphere
   sudo systemctl status elimusphere --no-pager
   ```

## Migration Path

To migrate from JaaS to self-hosted without downtime:

1. Deploy self-hosted Jitsi on separate VPS
2. Test with internal users in staging environment
3. Update `JITSI_DOMAIN` in production environment variables
4. Restart Elimusphere - no API changes needed
5. Existing JaaS sessions will complete naturally

To rollback, revert environment variables and restart.

## Notifications

Starting or reopening a lesson creates the existing in-app learning-timeline notification for its booked learners. The Jitsi path does not send email and does not use SendGrid or Resend.

