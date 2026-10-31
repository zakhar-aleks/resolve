import { describe, expect, it } from 'vitest';
import { operatorAuthorized, publicRoute, sameOriginWrite } from './access';
describe('workspace access boundary', () => {
  it('only permits explicit public pages and assets', () => {
    for (const path of ['/', '/privacy-policy', '/terms', '/_astro/app.js'])
      expect(publicRoute(new URL(path, 'https://resolve.test'))).toBe(true);
    for (const path of [
      '/?view=support',
      '/?view=',
      '/actions/execute',
      '/fragments/workspace',
      '/request-support',
      '/api/state',
      '/_astro/app.js.map',
    ])
      expect(publicRoute(new URL(path, 'https://resolve.test'))).toBe(false);
  });
  it('fails closed without a strong configured password', () => {
    const password = 'x'.repeat(40);
    const auth = (value: string) => `Basic ${Buffer.from(value).toString('base64')}`;
    expect(operatorAuthorized(null, password)).toBe(false);
    expect(operatorAuthorized(auth('resolve:'), '')).toBe(false);
    expect(operatorAuthorized(auth(`resolve:${password}`), password)).toBe(true);
    expect(operatorAuthorized(auth(`other:${password}`), password)).toBe(false);
    expect(operatorAuthorized(auth('resolve:wrong'), password)).toBe(false);
  });
  it('requires trusted origin for every mutation', () => {
    const origin = 'https://resolve.test';
    expect(sameOriginWrite(new Request(origin), origin)).toBe(true);
    expect(sameOriginWrite(new Request(origin, { method: 'POST' }), origin)).toBe(false);
    expect(
      sameOriginWrite(new Request(origin, { method: 'POST', headers: { origin } }), origin),
    ).toBe(true);
    expect(
      sameOriginWrite(
        new Request(origin, { method: 'POST', headers: { origin: 'https://evil.test' } }),
        origin,
      ),
    ).toBe(false);
  });
});
