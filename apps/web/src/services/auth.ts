import { z } from 'zod';
import { apiRequest } from '../wrappers/api-client';
import { serverEnvironment } from '../wrappers/server-environment';
export const ProfileSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  termsAccepted: z.boolean(),
  workspaceId: z.uuid().nullable(),
  role: z.enum(['owner', 'agent', 'reviewer']).nullable(),
  memberships: z.array(
    z.object({ workspaceId: z.uuid(), role: z.enum(['owner', 'agent', 'reviewer']) }),
  ),
});
export const providers = () =>
  apiRequest('/auth/providers', z.object({ google: z.boolean(), apple: z.boolean(), demo:z.boolean().default(false) }));
export const profile = (token: string) =>
  apiRequest('/auth/session', ProfileSchema, 'POST', { token });
export const cookieName = () =>
  serverEnvironment('WEB_ORIGIN').startsWith('https://')
    ? '__Host-resolve_session'
    : 'resolve_session';
export const cookieOptions = () => ({
  path: '/',
  httpOnly: true,
  secure: serverEnvironment('WEB_ORIGIN').startsWith('https://'),
  sameSite: 'lax' as const,
  maxAge: 43200,
});
export const startIdentity = (provider: 'google' | 'apple', browserSecret: string) =>
  apiRequest('/auth/begin', z.object({ url: z.url() }), 'POST', { provider, browserSecret });
export const finishIdentity = (
  provider: 'google' | 'apple',
  state: string,
  code: string,
  browserSecret: string,
) =>
  apiRequest('/auth/callback', z.object({ token: z.string().min(40) }), 'POST', {
    provider,
    state,
    code,
    browserSecret,
  });
export const onboard = (
  token: string,
  companyName: string,
  acceptTerms: boolean,
  privacyAcknowledged: boolean,
  inviteToken?: string,
) =>
  apiRequest('/auth/onboard', ProfileSchema, 'POST', {
    token,
    companyName,
    acceptTerms,
    privacyAcknowledged,
    ...(inviteToken ? { inviteToken } : {}),
  });
export const invite = (token: string, email: string, role: string) =>
  apiRequest('/auth/invite', z.object({ url: z.url(), delivered: z.boolean() }), 'POST', {
    token,
    email,
    role,
  });
export const logout = (token: string) =>
  apiRequest('/auth/logout', z.object({ ok: z.boolean() }), 'POST', { token });
export const switchWorkspace = (token: string, workspaceId: string) =>
  apiRequest('/auth/switch', ProfileSchema, 'POST', { token, workspaceId });

export const team = (token: string) =>
  apiRequest(
    '/auth/team',
    z.array(
      z.object({
        userId: z.uuid(),
        email: z.email(),
        role: z.enum(['owner', 'agent', 'reviewer']),
      }),
    ),
    'POST',
    { token },
  );
export const removeMember = (token: string, userId: string) =>
  apiRequest('/auth/remove-member', z.object({ ok: z.boolean() }), 'POST', { token, userId });
export const apiKeys = (token: string) =>
  apiRequest('/auth/api-keys', z.object({ intake: z.string(), reviewer: z.string() }), 'POST', {
    token,
  });
