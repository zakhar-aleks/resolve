import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { LessThan } from 'typeorm';
import { z } from 'zod';
import {
  AccountApiKeyEntity,
  AccountUserEntity,
  AccountWorkspaceEntity,
  InviteEntity,
  MembershipEntity,
  OAuthFlowEntity,
  SessionEntity,
} from '../database/entities/account.entity';
import { environment } from '../config/environment';
import { WorkspaceRegistry } from '../tenancy/registry.service';
import { IdentityProviderService } from './identity.provider';
import type { IdentityProvider } from './schemas';
import { conflict, invalid } from '../common/errors';
export const TERMS_VERSION = '2026-10-31';
export const tokenHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
export const emailHash = (value: string): string =>
  createHmac('sha256', environment.DATA_ENCRYPTION_KEY)
    .update(value.trim().toLowerCase())
    .digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
@Injectable()
export class AuthService {
  constructor(
    private readonly registry: WorkspaceRegistry,
    private readonly identity: IdentityProviderService,
  ) {}
  private get data() {
    return this.registry.catalogue;
  }
  async health() {
    await this.data.query('SELECT 1');
    return { ok: true };
  }
  providers() {
    return {
      google: !!(environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET),
      apple: !!(environment.APPLE_CLIENT_ID && environment.APPLE_CLIENT_SECRET),
    };
  }
  async begin(provider: IdentityProvider, browserSecret: string) {
    const config = this.identity.config(provider);
    if (!config.clientId || !config.secret) invalid('IDENTITY_PROVIDER_UNAVAILABLE');
    if (provider === 'apple' && !environment.WEB_ORIGIN.startsWith('https://'))
      invalid('APPLE_REQUIRES_HTTPS');
    await this.data
      .query(`DELETE FROM account_sessions WHERE "userId" IN (SELECT id FROM account_users u WHERE "termsVersion" IS NULL AND "createdAt" < NOW()-INTERVAL '30 days' AND NOT EXISTS(SELECT 1 FROM account_memberships m WHERE m."userId"=u.id));
    DELETE FROM account_users u WHERE "termsVersion" IS NULL AND "createdAt" < NOW()-INTERVAL '30 days' AND NOT EXISTS(SELECT 1 FROM account_memberships m WHERE m."userId"=u.id)`);
    const state = randomToken(),
      nonce = randomToken(),
      verifier = randomToken();
    await this.data.getRepository(OAuthFlowEntity).delete({ expiresAt: LessThan(new Date()) });
    await this.data.getRepository(SessionEntity).delete({ expiresAt: LessThan(new Date()) });
    await this.data.getRepository(OAuthFlowEntity).save({
      stateHash: tokenHash(state),
      browserHash: tokenHash(browserSecret),
      provider,
      secret: JSON.stringify({ nonce, verifier }),
      expiresAt: new Date(Date.now() + 600000),
    });
    const url = new URL(config.authorize);
    for (const [key, value] of Object.entries({
      client_id: config.clientId,
      redirect_uri: this.identity.callback(provider),
      response_type: 'code',
      scope: provider === 'google' ? 'openid email' : 'email',
      state,
      nonce,
    }))
      url.searchParams.set(key, value);
    if (provider === 'google') {
      url.searchParams.set(
        'code_challenge',
        createHash('sha256').update(verifier).digest('base64url'),
      );
      url.searchParams.set('code_challenge_method', 'S256');
    } else url.searchParams.set('response_mode', 'form_post');
    return { url: url.href };
  }
  async callback(provider: IdentityProvider, state: string, code: string, browserSecret: string) {
    const flow = await this.data.transaction(async (manager) => {
      const row = await manager.findOne(OAuthFlowEntity, {
        where: { stateHash: tokenHash(state) },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !row ||
        row.provider !== provider ||
        row.browserHash !== tokenHash(browserSecret) ||
        row.expiresAt.getTime() < Date.now()
      )
        invalid('SIGN_IN_FAILED');
      await manager.delete(OAuthFlowEntity, { stateHash: row.stateHash });
      return row;
    });
    const secret = z
      .object({ nonce: z.string(), verifier: z.string() })
      .parse(JSON.parse(flow.secret));
    const identity = await this.identity.exchange(provider, code, secret.verifier, secret.nonce);
    const identityHash = emailHash(`${provider}:${identity.subject}`);
    await this.data
      .createQueryBuilder()
      .insert()
      .into(AccountUserEntity)
      .values({
        id: randomUUID(),
        identityHash,
        email: identity.email,
        emailHash: emailHash(identity.email),
        provider,
        privacyVersion: null,
        termsVersion: null,
        termsAcceptedAt: null,
      })
      .orIgnore()
      .execute();
    const user = await this.data.getRepository(AccountUserEntity).findOneByOrFail({ identityHash });
    await this.data
      .getRepository(AccountUserEntity)
      .update(user.id, { email: identity.email, emailHash: emailHash(identity.email) });
    const membership = await this.data
      .getRepository(MembershipEntity)
      .findOneBy({ userId: user.id });
    const token = randomToken();
    await this.data.getRepository(SessionEntity).save({
      hash: tokenHash(token),
      userId: user.id,
      workspaceId: membership?.workspaceId ?? null,
      expiresAt: new Date(Date.now() + 12 * 3600000),
    });
    return { token };
  }
  async session(token: string) {
    const session = await this.data
      .getRepository(SessionEntity)
      .findOneBy({ hash: tokenHash(token) });
    if (!session || session.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED' });
    const user = await this.data
      .getRepository(AccountUserEntity)
      .findOneByOrFail({ id: session.userId });
    const memberships = await this.data.getRepository(MembershipEntity).findBy({ userId: user.id });
    const membership = memberships.find((item) => item.workspaceId === session.workspaceId);
    return { session, user, memberships, membership };
  }
  async profile(token: string) {
    const { session, user, memberships, membership } = await this.session(token);
    return {
      userId: user.id,
      email: user.email,
      termsAccepted: user.termsVersion === TERMS_VERSION && user.privacyVersion === TERMS_VERSION,
      workspaceId: session.workspaceId,
      role: membership?.role ?? null,
      memberships: memberships.map((m) => ({ workspaceId: m.workspaceId, role: m.role })),
    };
  }
  async onboard(token: string, companyName: string, inviteToken?: string) {
    const { user, session } = await this.session(token);
    await this.data.getRepository(AccountUserEntity).update(user.id, {
      termsVersion: TERMS_VERSION,
      privacyVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
    });
    if (inviteToken) {
      await this.acceptInvite(token, inviteToken);
      return this.profile(token);
    }
    if (!companyName.trim()) invalid('COMPANY_NAME_REQUIRED');
    const workspace = await this.data.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'resolve-workspace-provision',
      ]);
      const previous = await manager.findOneBy(MembershipEntity, {
        userId: user.id,
        role: 'owner',
      });
      if (previous)
        return manager.findOneByOrFail(AccountWorkspaceEntity, { id: previous.workspaceId });
      if ((await manager.count(AccountWorkspaceEntity)) >= environment.MAX_WORKSPACES)
        conflict('WORKSPACE_CAPACITY_REACHED');
      const id = randomUUID();
      const row = await manager.save(AccountWorkspaceEntity, {
        id,
        databaseName: `resolve_t_${id.replaceAll('-', '')}`,
        ready: false,
      });
      await manager.save(MembershipEntity, { userId: user.id, workspaceId: id, role: 'owner' });
      return row;
    });
    if (!workspace.ready) await this.registry.provision(workspace, companyName);
    session.workspaceId = workspace.id;
    await this.data.getRepository(SessionEntity).save(session);
    return this.profile(token);
  }
  async access(token: string) {
    const { user, membership } = await this.session(token);
    if (user.termsVersion !== TERMS_VERSION || user.privacyVersion !== TERMS_VERSION || !membership)
      throw new UnauthorizedException({ code: 'ONBOARDING_REQUIRED' });
    const workspace = await this.data
      .getRepository(AccountWorkspaceEntity)
      .findOneByOrFail({ id: membership.workspaceId, ready: true });
    return this.registry.context(workspace, membership.role, user.id);
  }
  async switchWorkspace(token: string, workspaceId: string) {
    const { session, memberships } = await this.session(token);
    if (!memberships.some((m) => m.workspaceId === workspaceId))
      throw new UnauthorizedException({ code: 'WORKSPACE_ACCESS_DENIED' });
    session.workspaceId = workspaceId;
    await this.data.getRepository(SessionEntity).save(session);
    return this.profile(token);
  }
  async invite(token: string, email: string, role: 'agent' | 'reviewer') {
    const { user, membership } = await this.session(token);
    if (!membership || membership.role !== 'owner')
      throw new UnauthorizedException({ code: 'OWNER_REQUIRED' });
    await this.data.getRepository(InviteEntity).delete({ expiresAt: LessThan(new Date()) });
    const count = await this.data
      .getRepository(InviteEntity)
      .countBy({ workspaceId: membership.workspaceId });
    if (count >= 20) conflict('INVITE_LIMIT_REACHED');
    const inviteToken = randomToken();
    await this.data.getRepository(InviteEntity).save({
      hash: tokenHash(inviteToken),
      workspaceId: membership.workspaceId,
      createdBy: user.id,
      emailHash: emailHash(email),
      role,
      expiresAt: new Date(Date.now() + 86400000),
    });
    const url = `${environment.WEB_ORIGIN}/join?token=${encodeURIComponent(inviteToken)}`;
    let delivered = false;
    if (environment.INVITE_EMAIL_API_KEY && environment.INVITE_EMAIL_FROM) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${environment.INVITE_EMAIL_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': tokenHash(inviteToken),
        },
        body: JSON.stringify({
          from: environment.INVITE_EMAIL_FROM,
          to: [email],
          subject: 'Invitation to your Resolve workspace',
          text: `You have been invited to a Resolve company workspace as ${role}. Sign in using this email address to join. This link expires in 24 hours.\n\n${url}\n\nIf you were not expecting this, ignore it.`,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      delivered = response?.ok ?? false;
    }
    return { url, delivered };
  }
  async acceptInvite(token: string, inviteToken: string) {
    const { user, session } = await this.session(token);
    if (user.termsVersion !== TERMS_VERSION) invalid('ONBOARDING_REQUIRED');
    await this.data.transaction(async (manager) => {
      const invite = await manager.findOne(InviteEntity, {
        where: { hash: tokenHash(inviteToken) },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !invite ||
        invite.expiresAt.getTime() <= Date.now() ||
        invite.emailHash !== user.emailHash
      )
        invalid('INVITATION_INVALID');
      if (
        !(await manager.exists(MembershipEntity, {
          where: { userId: user.id, workspaceId: invite.workspaceId },
        }))
      )
        await manager.save(MembershipEntity, {
          userId: user.id,
          workspaceId: invite.workspaceId,
          role: invite.role,
        });
      session.workspaceId = invite.workspaceId;
      await manager.save(session);
      await manager.delete(InviteEntity, { hash: invite.hash });
    });
  }
  async team(token: string) {
    const { membership } = await this.session(token);
    if (!membership || membership.role !== 'owner')
      throw new UnauthorizedException({ code: 'OWNER_REQUIRED' });
    const rows = await this.data
      .getRepository(MembershipEntity)
      .findBy({ workspaceId: membership.workspaceId });
    return Promise.all(
      rows.map(async (row) => {
        const user = await this.data
          .getRepository(AccountUserEntity)
          .findOneByOrFail({ id: row.userId });
        return { userId: row.userId, email: user.email, role: row.role };
      }),
    );
  }
  async removeMember(token: string, userId: string) {
    const { membership } = await this.session(token);
    if (!membership || membership.role !== 'owner')
      throw new UnauthorizedException({ code: 'OWNER_REQUIRED' });
    const target = await this.data
      .getRepository(MembershipEntity)
      .findOneBy({ workspaceId: membership.workspaceId, userId });
    if (target?.role === 'owner') conflict('OWNER_CANNOT_BE_REMOVED');
    await this.data
      .getRepository(MembershipEntity)
      .delete({ workspaceId: membership.workspaceId, userId });
    return { ok: true };
  }
  async apiKeys(token: string) {
    const { membership } = await this.session(token);
    if (!membership || membership.role !== 'owner')
      throw new UnauthorizedException({ code: 'OWNER_REQUIRED' });
    const intake = randomToken(),
      reviewer = randomToken();
    await this.data.transaction(async (manager) => {
      await manager.delete(AccountApiKeyEntity, { workspaceId: membership.workspaceId });
      await manager.save(AccountApiKeyEntity, [
        { hash: tokenHash(intake), workspaceId: membership.workspaceId, role: 'intake' },
        { hash: tokenHash(reviewer), workspaceId: membership.workspaceId, role: 'reviewer' },
      ]);
    });
    return { intake, reviewer };
  }
  async logout(token: string) {
    await this.data.getRepository(SessionEntity).delete({ hash: tokenHash(token) });
    return { ok: true };
  }
}
