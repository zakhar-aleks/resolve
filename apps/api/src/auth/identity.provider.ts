import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { environment } from '../config/environment';
import type { IdentityProvider } from './schemas';
import { invalid } from '../common/errors';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
@Injectable()
export class IdentityProviderService {
  config(provider: IdentityProvider) {
    return provider === 'google'
      ? {
          clientId: environment.GOOGLE_CLIENT_ID,
          secret: environment.GOOGLE_CLIENT_SECRET,
          issuer: 'https://accounts.google.com',
          authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
          token: 'https://oauth2.googleapis.com/token',
          keys: googleKeys,
        }
      : {
          clientId: environment.APPLE_CLIENT_ID,
          secret: environment.APPLE_CLIENT_SECRET,
          issuer: 'https://appleid.apple.com',
          authorize: 'https://appleid.apple.com/auth/authorize',
          token: 'https://appleid.apple.com/auth/token',
          keys: appleKeys,
        };
  }
  callback(provider: IdentityProvider): string {
    return `${environment.WEB_ORIGIN}/auth/callback/${provider}`;
  }
  async exchange(
    provider: IdentityProvider,
    code: string,
    verifier: string,
    nonce: string,
  ): Promise<{ subject: string; email: string }> {
    const config = this.config(provider);
    if (!config.clientId || !config.secret) invalid('IDENTITY_PROVIDER_UNAVAILABLE');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: this.callback(provider),
    });
    if (provider === 'google') body.set('code_verifier', verifier);
    const response = await fetch(config.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) invalid('SIGN_IN_FAILED');
    const tokens = z.object({ id_token: z.string().max(20000) }).parse(await response.json());
    const { payload } = await jwtVerify(tokens.id_token, config.keys, {
      issuer: config.issuer,
      audience: config.clientId,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
      maxTokenAge: '15m',
    });
    if (payload.nonce !== nonce) invalid('SIGN_IN_FAILED');
    const claims = z
      .object({
        sub: z.string().min(1).max(255),
        email: z.email(),
        email_verified: z.union([z.literal(true), z.literal('true')]),
      })
      .parse(payload);
    return { subject: claims.sub, email: claims.email.toLowerCase() };
  }
}
