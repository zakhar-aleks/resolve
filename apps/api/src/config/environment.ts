import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });
const schema = z.object({
  DATABASE_URL: z.string().default('postgresql://resolve:resolve@127.0.0.1:55432/resolve'),
  API_PORT: z.coerce.number().int().default(8788),
  WEB_ORIGIN: z.url().default('http://127.0.0.1:8787'),
  MISTRAL_MODEL: z.string().default('mistral-small-2603'),
  MISTRAL_API_KEY: z.string().default(''),
  TYPESAFE_API_KEY: z.string().default(''),
  JEV_MODEL: z.string().default('jev-latest'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_TEST_CUSTOMER_ID: z.string().default(''),
  STRIPE_TEST_PAYMENT_INTENT_ID: z.string().default(''),
});
export const environment = schema.parse(process.env);
