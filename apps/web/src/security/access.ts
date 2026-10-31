import { timingSafeEqual } from 'node:crypto';
export function secretMatches(actual: string, expected: string): boolean {
  return (
    expected.length >= 32 &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
export function publicRoute(url: URL): boolean {
  return (
    (url.pathname === '/' && !url.searchParams.has('view')) ||
    ['/privacy-policy', '/terms'].includes(url.pathname) ||
    (url.pathname.startsWith('/_astro/') && !url.pathname.endsWith('.map'))
  );
}
export function operatorAuthorized(header: string | null, password: string): boolean {
  if (!header?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  return secretMatches(decoded, `resolve:${password}`) && password.length >= 32;
}
export function sameOriginWrite(request: Request, origin: string): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  return (
    request.headers.get('origin') === origin &&
    !['cross-site', 'none'].includes(request.headers.get('sec-fetch-site') ?? '')
  );
}
