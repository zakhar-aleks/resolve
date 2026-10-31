import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const domain = process.argv[2];
if (
  !domain ||
  domain.length > 253 ||
  !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/u.test(domain)
) {
  console.error('Usage: node scripts/deployment-env.mjs demo.your-domain.com');
  process.exit(1);
}
const secret = () => randomBytes(32).toString('hex');
const contents = `PUBLIC_DOMAIN=${domain}
POSTGRES_DATA_PATH=/mnt/resolve_data/postgres
DATA_ENCRYPTION_KEY=${secret()}
POSTGRES_PASSWORD=${secret()}
WORKSPACE_PASSWORD=${secret()}
INTERNAL_API_TOKEN=${secret()}
RESOLVE_API_KEY=${secret()}
RESOLVE_REVIEWER_KEY=${secret()}
ALLOW_BASIC_AUTH=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
INVITE_EMAIL_API_KEY=
INVITE_EMAIL_FROM=
MAX_WORKSPACES=50
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-2603
MISTRAL_LARGE_MODEL=
TYPESAFE_API_KEY=
SLACK_APP_TOKEN=
SLACK_TEAM_ID=
SLACK_CHANNEL_IDS=
SLACK_BOT_TOKEN=
`;
await writeFile(new URL('../.env.deploy', import.meta.url), contents, { mode: 0o600, flag: 'wx' });
console.log(
  'Created .env.deploy with fresh credentials. Existing files are never overwritten. Keep it private.',
);
