import { z } from 'zod';
export const SlackSettingsSchema = z.strictObject({
  appToken: z
    .string()
    .max(500)
    .refine((v) => v === '' || v.startsWith('xapp-')),
  teamId: z.string().regex(/^(?:T[A-Z0-9]+)?$/u),
  channelIds: z
    .string()
    .max(2000)
    .regex(/^(?:[CG][A-Z0-9]+(?:,[CG][A-Z0-9]+)*)?$/u),
  botToken: z
    .string()
    .max(500)
    .refine((v) => v === '' || v.startsWith('xoxb-')),
});
export type SlackSettings = z.infer<typeof SlackSettingsSchema>;
