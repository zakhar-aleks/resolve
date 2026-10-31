import { z } from 'zod';
export const ProviderSchema = z.enum(['google', 'apple']);
export type IdentityProvider = z.infer<typeof ProviderSchema>;
export const BeginSchema = z.strictObject({
  provider: ProviderSchema,
  browserSecret: z.string().min(40).max(100),
});
export const CallbackSchema = z.strictObject({
  provider: ProviderSchema,
  state: z.string().min(40).max(100),
  code: z.string().min(1).max(4096),
  browserSecret: z.string().min(40).max(100),
});
export const SessionInputSchema = z.strictObject({ token: z.string().min(40).max(100) });
export const OnboardSchema = SessionInputSchema.extend({
  companyName: z.string().trim().max(80),
  inviteToken: z.string().min(40).max(100).optional(),
  acceptTerms: z.literal(true),
  privacyAcknowledged: z.literal(true),
});
export const InviteSchema = SessionInputSchema.extend({
  email: z.email().max(254),
  role: z.enum(['agent', 'reviewer']),
});
export const AcceptInviteSchema = SessionInputSchema.extend({
  inviteToken: z.string().min(40).max(100),
});
