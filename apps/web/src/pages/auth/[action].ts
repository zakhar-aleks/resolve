import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import {
  startIdentity,
  cookieName,
  cookieOptions,
  onboard,
  logout,
  switchWorkspace,
} from '../../services/auth';
import { text } from '../../helpers/forms';
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  try {
    const token = cookies.get(cookieName())?.value ?? '';
    if (params.action === 'google' || params.action === 'apple') {
      const secret = randomBytes(32).toString('base64url');
      const { url } = await startIdentity(params.action, secret);
      cookies.set('resolve_flow', secret, {
        ...cookieOptions(),
        path: '/auth/callback',
        sameSite: params.action === 'apple' ? 'none' : 'lax',
        maxAge: 600,
      });
      return redirect(url, 303);
    }
    if (params.action === 'logout') {
      if (token) await logout(token);
      cookies.delete(cookieName(), { path: '/' });
      return redirect('/', 303);
    }
    const form = await request.formData();
    if (params.action === 'onboard') {
      const inviteToken = cookies.get('resolve_invite')?.value;
      await onboard(
        token,
        text(form, 'companyName'),
        form.has('terms'),
        form.has('privacy'),
        inviteToken,
      );
      cookies.delete('resolve_invite', { path: '/' });
      return redirect('/?view=support', 303);
    }
    if (params.action === 'switch') {
      await switchWorkspace(token, text(form, 'workspaceId'));
      return redirect('/?view=support', 303);
    }
    return new Response(null, { status: 404 });
  } catch {
    return redirect(params.action === 'onboard' ? '/onboarding?error=1' : '/signin?error=1', 303);
  }
};
