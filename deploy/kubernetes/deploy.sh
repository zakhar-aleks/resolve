#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
image="${1:?Usage: bash deploy/kubernetes/deploy.sh registry/image:tag}"
if [[ ! -f .env.deploy ]]; then
  echo 'Create .env.deploy with node scripts/deployment-env.mjs YOUR_DOMAIN, then configure OAuth credentials.' >&2
  exit 1
fi
kubectl apply -f deploy/kubernetes/namespace.yaml
kubectl -n resolve create secret generic resolve-secrets --from-env-file=.env.deploy --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deploy/kubernetes/postgres.yaml
kubectl rollout status -n resolve statefulset/postgres --timeout=180s
# Render without editing the committed template or printing secret values.
APP_IMAGE="$image" node --input-type=module -e "import {readFileSync} from 'node:fs'; process.stdout.write(readFileSync('deploy/kubernetes/app.yaml','utf8').replace('REPLACE_WITH_REGISTRY_IMAGE',process.env.APP_IMAGE));" | kubectl apply -f -
kubectl rollout status -n resolve deployment/resolve --timeout=300s
kubectl -n resolve get service resolve-public
