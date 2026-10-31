import { profile, cookieName } from './services/auth';
import { requestContext } from './security/request-context';
import { serverEnvironment } from './wrappers/server-environment';
import { SECURITY_COPY } from './consts/security';
import { defineMiddleware } from 'astro:middleware';
import { operatorAuthorized, publicRoute, sameOriginWrite } from './security/access';
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://accounts.google.com https://appleid.apple.com; object-src 'none'",
};
export const onRequest = defineMiddleware(async (context, next) => {
  const password = serverEnvironment('WORKSPACE_PASSWORD');
  const origin = serverEnvironment('WEB_ORIGIN') || 'http://127.0.0.1:8787';
  const path = context.url.pathname;
  const appleCallback =
    path === '/auth/callback/apple' &&
    context.request.method === 'POST' &&
    context.request.headers.get('origin') === 'https://appleid.apple.com';
  const authRoute = /^\/auth\/(google|apple|logout|onboard|switch|callback\/(google|apple))$/u.test(
    path,
  );
  const token = context.cookies.get(cookieName())?.value ?? '';
  const apiRequest = path.startsWith('/api/v1/agent/') && requestAuthorization(context.request);
  let response: Response;
  if (Number(context.request.headers.get('content-length') ?? 0) > 81920)
    response = new Response(null, { status: 413 });
  else if (
    !appleCallback &&
    !(apiRequest && !context.request.headers.has('origin')) &&
    !sameOriginWrite(context.request, origin)
  )
    response = new Response(SECURITY_COPY.rejected, { status: 403 });
  else if (publicRoute(context.url) || authRoute) response = await next();
  else if (
    serverEnvironment('ALLOW_BASIC_AUTH') === 'true' &&
    operatorAuthorized(context.request.headers.get('authorization'), password)
  )
    response = await next();
  else {
    const account = token ? await profile(token).catch(() => null) : null;
    if (!account)
      response = new Response(null, {
        status: 303,
        headers: { Location: new URL('/signin', origin).href },
      });
    else if (path !== '/onboarding' && (!account.termsAccepted || !account.workspaceId))
      response = new Response(null, {
        status: 303,
        headers: { Location: new URL('/onboarding', origin).href },
      });
    else response = await requestContext.run({ token }, next);
  }
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
});

function requestAuthorization(request: Request): boolean {
  return /^Bearer [A-Za-z0-9_-]{32,100}$/u.test(request.headers.get('authorization') ?? '');
}
