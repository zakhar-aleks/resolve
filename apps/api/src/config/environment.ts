import { workspaceContext } from '../tenancy/context';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });
const schema = z.object({
  DATA_ENCRYPTION_KEY: z
    .string()
    .regex(/^(?:[a-fA-F0-9]{64})?$/u)
    .default(''),
  MAX_WORKSPACES: z.coerce.number().int().min(1).max(1000).default(50),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_CA_CERT: z.string().default(''),
  INVITE_EMAIL_API_KEY: z.string().default(''),
  INVITE_EMAIL_FROM: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  APPLE_CLIENT_ID: z.string().default(''),
  APPLE_CLIENT_SECRET: z.string().default(''),
  ALLOW_BASIC_AUTH: z.enum(['true', 'false']).default('false'),
  INTERNAL_API_TOKEN: z.string().default(''),
  DATABASE_URL: z.string().default('postgresql://resolve:resolve@127.0.0.1:55432/resolve'),
  API_PORT: z.coerce.number().int().default(8788),
  WEB_ORIGIN: z.url().default('http://127.0.0.1:8787'),
  MISTRAL_MODEL: z.string().default('mistral-small-2603'),
  MISTRAL_LARGE_MODEL: z.string().default(''),
  MISTRAL_API_KEY: z.string().default(''),
  TYPESAFE_API_KEY: z.string().default(''),
  SLACK_APP_TOKEN: z.string().default(''),
  SLACK_TEAM_ID: z.string().default(''),
  SLACK_CHANNEL_IDS: z.string().default(''),
  RESOLVE_API_KEY: z.string().default(''),
  RESOLVE_REVIEWER_KEY: z.string().default(''),
  SERVICE_CONNECTOR_URL: z
    .union([
      z.literal(''),
      z.url().refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
        );
      }),
    ])
    .default(''),
  SERVICE_CONNECTOR_TOKEN: z.string().default(''),
  SLACK_BOT_TOKEN: z.string().default(''),
  JEV_MODEL: z.string().default('jev-latest'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_TEST_CUSTOMER_ID: z.string().default(''),
  STRIPE_TEST_PAYMENT_INTENT_ID: z.string().default(''),
});
const configured = schema.parse(process.env);
const privateSettings = new Set([
  'MISTRAL_API_KEY',
  'TYPESAFE_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_TEST_CUSTOMER_ID',
  'STRIPE_TEST_PAYMENT_INTENT_ID',
  'SERVICE_CONNECTOR_URL',
  'SERVICE_CONNECTOR_TOKEN',
  'SLACK_APP_TOKEN',
  'SLACK_TEAM_ID',
  'SLACK_CHANNEL_IDS',
  'SLACK_BOT_TOKEN',
  'RESOLVE_API_KEY',
  'RESOLVE_REVIEWER_KEY',
]);
export const environment = new Proxy(configured, {
  get(target, property) {
    const context = workspaceContext.getStore();
    if (context && privateSettings.has(String(property)))
      return context.secrets[String(property)] ?? '';
    return Reflect.get(target, property);
  },
});
