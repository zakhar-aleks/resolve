import type { APIRoute } from 'astro';
import { serverEnvironment } from '../../../../wrappers/server-environment';
export const ALL: APIRoute = async ({ params, request }) => {
  const path = params.path ?? '';
  if (!path.split('/').every((part) => /^[a-zA-Z0-9-]+$/u.test(part)))
    return new Response(null, { status: 404 });
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9_-]{32,100}$/u.test(authorization))
    return new Response(null, { status: 401 });
  try {
    const response = await fetch(
      `${serverEnvironment('API_URL') || 'http://127.0.0.1:8788/api'}/v1/agent/${path}`,
      {
        method: request.method,
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: await request.text() }),
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
      },
    );
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
};
