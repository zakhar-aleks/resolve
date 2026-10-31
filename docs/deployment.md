# Simple DigitalOcean deployment

This deploys the protected single-company demo on a Debian server with Docker Compose. The application image is Debian Bookworm with Node.js 24. Astro and Nest share a container so the API can remain on loopback; PostgreSQL is separate with a persistent volume. Caddy exposes only ports 80/443 and obtains HTTPS certificates automatically. No API or database port is published.

## First deployment

Use a Debian Droplet with Docker Engine and the Compose plugin installed from Docker's official repository. Start with 2 GB RAM; builds may need more memory or swap. Point a DNS A record (and an AAAA record only if IPv6 is configured) for your chosen subdomain to the server. Allow inbound SSH from your own IP and TCP 80/443; do not open 8787, 8788 or 5432. Use SSH keys.

On the server:

```sh
git clone https://github.com/zakhar-aleks/resolve.git
cd resolve
# Generate config using Node inside the Debian-based image; no host Node installation needed.
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/app" -w /app node:24-bookworm-slim node scripts/deployment-env.mjs support.your-domain.com
docker compose --env-file .env.deploy -f compose.deploy.yaml config --quiet
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d --build --wait
```

Replace `support.your-domain.com` with your actual DNS name. The generator refuses to overwrite an existing `.env.deploy`. It creates distinct random passwords and API credentials with mode 0600. Do not paste this file into chats, logs or source control. Do not run `docker compose config` without `--quiet` when sharing output: expanded configuration contains secrets.

Open your HTTPS domain. The landing, privacy notice and terms are public. Workspace pages, intake and form actions require username `resolve` and the `WORKSPACE_PASSWORD` value in `.env.deploy`. The Agent API is not exposed by this configuration. Caddy forwards only to Astro; Nest remains on 127.0.0.1 inside the app container.

Initially keep all provider keys blank and use fictional demo records. To test Mistral or Slack, edit `.env.deploy` privately, configure the company processing settings, and recreate the app:

```sh
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d --force-recreate app
```

Both services read runtime environment variables; credentials are not baked into the image. Any variables supported by `.env.example` can be added to `.env.deploy`, but live service/financial credentials should stay out of the first demo deployment.

## Operations

```sh
# Status and bounded recent logs
docker compose --env-file .env.deploy -f compose.deploy.yaml ps
docker compose --env-file .env.deploy -f compose.deploy.yaml logs --tail=100 app proxy
# Deploy an updated revision
git pull --ff-only
docker compose --env-file .env.deploy -f compose.deploy.yaml up -d --build --wait
# Stop while preserving data
docker compose --env-file .env.deploy -f compose.deploy.yaml down
```

The app runs as an unprivileged user, drops Linux capabilities and restarts if either child process exits. Health checks verify web availability and authenticated database-backed API state; unhealthy status alone does not restart Docker containers. Monitor health and add alerts before operational use. PostgreSQL readiness is checked before the app starts. TypeORM runs migrations and seeds fictional fixtures on startup. Run only one app replica: worker leases and multi-instance startup coordination are not implemented.

PostgreSQL and Caddy certificate data use named volumes. **Do not use `down -v` unless you intend to delete the deployment data.** Before updates, create a backup in a protected directory:

```sh
mkdir -p backups
chmod 700 backups
umask 077
docker compose --env-file .env.deploy -f compose.deploy.yaml exec -T postgres pg_dump -U resolve -d resolve -Fc > backups/resolve.dump
```

Store an encrypted copy off-server and rehearse restoring to a separate database. A database password change in `.env.deploy` does not change the password inside an existing PostgreSQL volume; rotate the database role deliberately. Rollback may require restoring a compatible database backup as well as the previous application revision.

## Scope

This is a protected demo deployment, not multi-tenant production SaaS. Shared Basic authentication needs HTTPS and does not provide named reviewers, signup, MFA or tenant isolation. API request limits are per process. Real integrations, model behavior, backups, monitoring and privacy operations still require validation. Docker configuration does not establish GDPR compliance or enforce European data residency; choose and verify actual hosting/provider arrangements separately.

Official setup references: [Docker on Debian](https://docs.docker.com/engine/install/debian/), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
