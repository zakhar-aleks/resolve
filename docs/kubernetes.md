# DigitalOcean Kubernetes deployment

Target cluster: `4eac6992-9826-4be4-b971-0500a4c6fce3`. These manifests use one app replica with a Caddy HTTPS sidecar, a private PostgreSQL StatefulSet, DigitalOcean block-storage PVCs, network policies, probes and resource limits. They create a billable LoadBalancer and storage volumes when applied. Signup and invitations still need real provider/email credentials.

```sh
doctl kubernetes cluster kubeconfig save 4eac6992-9826-4be4-b971-0500a4c6fce3
node scripts/deployment-env.mjs YOUR_DOMAIN
# Privately edit .env.deploy: Google/Apple callbacks and optional invitation email configuration.
# Push the Dockerfile image to your registry, then provide registry access to the namespace.
bash deploy/kubernetes/deploy.sh registry.digitalocean.com/YOUR_REGISTRY/resolve:YOUR_TAG
```

For DigitalOcean Container Registry, after creating the namespace, use its Kubernetes manifest for the pull secret named `registry-resolve` (or change `imagePullSecrets` to your registry's secret name). Do not paste registry tokens into Git, command-line arguments or chat. Build for the cluster node architecture; a typical DOKS node uses linux/amd64, so a Mac ARM build needs `docker buildx build --platform linux/amd64 --push -t IMAGE .`.

Point your domain's A record to the external IP from `kubectl -n resolve get service resolve-public`. Caddy then provisions HTTPS on ports 80/443. API/database ports are not public. Only the authenticated `/api/v1/agent/**` gateway is exposed; private workspace and operator routes require authenticated sessions. The supplied setup serves a configured domain, not an arbitrary IP hostname.

Configure Google return URL `https://YOUR_DOMAIN/auth/callback/google`; Apple return URL `https://YOUR_DOMAIN/auth/callback/apple`. Apple needs a Services ID, verified web domain and valid client-secret JWT. Missing credentials leave sign-in buttons disabled. Resend sender/API credentials enable invitation email; otherwise owners can share expiring, email-bound links privately.

Secrets are applied from ignored `.env.deploy`. Preserve the encryption master key and PostgreSQL password: recreating either without migrating data will break access. Use encrypted storage for configuration/backups and verify DOKS secret protection and RBAC. DigitalOcean block volumes provide storage encryption; application content also uses AES-GCM. PostgreSQL traffic stays on the private cluster network; it is not TLS encrypted in this simple deployment. Do not put real customer information in a public demo before operational and provider acceptance.

Do not delete the namespace/PVCs to update: that can destroy company databases and certificate state. Build a new immutable image tag and run the deployment script again. Back up every company database plus the authentication catalogue, not only the `resolve` database. The app must stay at one replica until worker leasing and multi-instance recovery are implemented.

No additional code checks were run after the user's instruction to stop checking; container build/deployment results must be reported separately from the earlier tests.
