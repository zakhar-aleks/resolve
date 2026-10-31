import type { NextFunction, Request, Response } from 'express';
import { type AuthService, tokenHash } from '../auth/auth.service';
import { AccountApiKeyEntity, AccountWorkspaceEntity } from '../database/entities/account.entity';
import { environment } from '../config/environment';
import type { WorkspaceRegistry } from './registry.service';
import { workspaceContext } from './context';
export function tenantBoundary(auth: AuthService, registry: WorkspaceRegistry) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const path = request.path.toLowerCase();
      if (path.startsWith('/api/auth/')) {
        next();
        return;
      }
      const session = request.headers['x-resolve-session'];
      let context;
      if (path.startsWith('/api/v1/agent')) {
        const bearer = request.headers.authorization?.replace(/^Bearer /u, '') ?? '';
        const key = await registry.catalogue
          .getRepository(AccountApiKeyEntity)
          .findOneBy({ hash: tokenHash(bearer) });
        if (key) {
          const workspace = await registry.catalogue
            .getRepository(AccountWorkspaceEntity)
            .findOneByOrFail({ id: key.workspaceId, ready: true });
          context = await registry.context(workspace, key.role === 'reviewer' ? 'owner' : 'agent');
          context.apiRole = key.role;
        } else if (environment.ALLOW_BASIC_AUTH !== 'true') {
          response.status(401).json({ code: 'AGENT_ACCESS_DENIED' });
          return;
        }
      } else if (typeof session === 'string' && session) {
        context = await auth.access(session);
      } else if (environment.ALLOW_BASIC_AUTH !== 'true') {
        response.status(401).json({ code: 'SESSION_REQUIRED' });
        return;
      }
      if (!context) {
        next();
        return;
      }
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      const admin =
        mutation &&
        (/^\/api\/(company|privacy|connections)(\/|$)/u.test(path) || request.method === 'PUT');
      const reviewer = mutation && /\/(execute|reconcile)\/?$/u.test(path);
      if ((admin && context.role !== 'owner') || (reviewer && context.role === 'agent')) {
        response.status(403).json({ code: 'INSUFFICIENT_ROLE' });
        return;
      }
      workspaceContext.run(context, next);
    } catch {
      response.status(401).json({ code: 'SESSION_OR_WORKSPACE_INVALID' });
    }
  };
}
