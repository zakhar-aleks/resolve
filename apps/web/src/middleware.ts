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
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
};
export const onRequest = defineMiddleware(async (context, next) => {
  const password = serverEnvironment('WORKSPACE_PASSWORD');
  const origin = serverEnvironment('WEB_ORIGIN') || 'http://127.0.0.1:8787';
  let response: Response;
  if (!sameOriginWrite(context.request, origin)) {
    response = new Response(SECURITY_COPY.rejected, { status: 403 });
  } else if (!publicRoute(context.url) && password.length < 32) {
    response = new Response(SECURITY_COPY.unconfigured, { status: 503 });
  } else if (
    !publicRoute(context.url) &&
    !operatorAuthorized(context.request.headers.get('authorization'), password)
  ) {
    response = new Response(SECURITY_COPY.authentication, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Resolve workspace", charset="UTF-8"' },
    });
  } else {
    response = await next();
  }
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
});
