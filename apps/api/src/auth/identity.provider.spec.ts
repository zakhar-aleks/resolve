import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { environment } from '../config/environment';
import { IdentityProviderService } from './identity.provider';
const originalId = environment.GOOGLE_CLIENT_ID,
  originalSecret = environment.GOOGLE_CLIENT_SECRET;
let privateKey: CryptoKey;
let jwk: Awaited<ReturnType<typeof exportJWK>>;
let idToken = '';
beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  jwk = await exportJWK(pair.publicKey);
  jwk.kid = 'fixture-signing-key';
  environment.GOOGLE_CLIENT_ID = 'fixture-client';
  environment.GOOGLE_CLIENT_SECRET = 'fixture-secret';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) =>
      String(input).includes('/certs')
        ? new Response(JSON.stringify({ keys: [jwk] }), {
            headers: { 'Content-Type': 'application/json' },
          })
        : new Response(JSON.stringify({ id_token: idToken }), {
            headers: { 'Content-Type': 'application/json' },
          }),
    ),
  );
});
afterAll(() => {
  environment.GOOGLE_CLIENT_ID = originalId;
  environment.GOOGLE_CLIENT_SECRET = originalSecret;
  vi.unstubAllGlobals();
});
async function signed(audience = 'fixture-client', nonce = 'bound-nonce', verified = true) {
  return new SignJWT({ nonce, email: 'person@example.com', email_verified: verified })
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture-signing-key' })
    .setIssuer('https://accounts.google.com')
    .setAudience(audience)
    .setSubject('provider-subject')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}
describe('provider identity validation', () => {
  it('verifies the signed token and only returns the needed identity fields', async () => {
    idToken = await signed();
    const provider = new IdentityProviderService();
    expect(
      await provider.exchange('google', 'one-time-code', 'pkce-verifier', 'bound-nonce'),
    ).toEqual({ subject: 'provider-subject', email: 'person@example.com' });
  });
  it('rejects another audience, a mismatched nonce and an unverified email', async () => {
    const provider = new IdentityProviderService();
    idToken = await signed('attacker-client');
    await expect(provider.exchange('google', 'code', 'verifier', 'bound-nonce')).rejects.toThrow();
    idToken = await signed('fixture-client', 'wrong-nonce');
    await expect(provider.exchange('google', 'code', 'verifier', 'bound-nonce')).rejects.toThrow();
    idToken = await signed('fixture-client', 'bound-nonce', false);
    await expect(provider.exchange('google', 'code', 'verifier', 'bound-nonce')).rejects.toThrow();
  });
});
