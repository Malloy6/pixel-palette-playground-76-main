# Cloudflare resource storage

Production resource uploads use the R2 binding `RESOURCE_BUCKET` so files persist across Worker instances. Before the first Cloudflare deployment, create the configured bucket:

```sh
npx wrangler r2 bucket create elimusphere-resources-prod
```

The production binding is declared in `wrangler.jsonc`. Deployments made before the bucket exists will fail to bind storage. Files are limited to 25 MB. Self-hosted Node deployments continue to use `public/uploads`; ensure that directory is on persistent, writable storage and is included in backups.
