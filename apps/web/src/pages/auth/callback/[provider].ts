import type { APIRoute } from 'astro';
import { finishIdentity, cookieName, cookieOptions } from '../../../services/auth';
const callback: APIRoute = async ({ params, request, url, cookies, redirect }) => {
  try {
    const provider = params.provider;
    if (provider !== 'google' && provider !== 'apple') return new Response(null, { status: 404 });
    if (
      (provider === 'google' && request.method !== 'GET') ||
      (provider === 'apple' && request.method !== 'POST')
    )
      return new Response(null, { status: 405 });
    const values = provider === 'apple' ? await request.formData() : url.searchParams;
    const state = String(values.get('state') ?? ''),
      code = String(values.get('code') ?? '');
    const browserSecret = cookies.get('resolve_flow')?.value ?? '';
    cookies.delete('resolve_flow', { path: '/auth/callback' });
    const { token } = await finishIdentity(provider, state, code, browserSecret);
    cookies.set(cookieName(), token, cookieOptions());
    return redirect('/onboarding', 303);
  } catch {
    return redirect('/signin?error=1', 303);
  }
};
export const GET = callback;
export const POST = callback;
