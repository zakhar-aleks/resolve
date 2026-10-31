import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { environment } from '../../config/environment';
function matches(input: string, expected: string): boolean {
  return (
    expected.length >= 32 &&
    Buffer.byteLength(input) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(input), Buffer.from(expected))
  );
}
@Injectable()
export class AgentKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (
      environment.RESOLVE_API_KEY.length < 32 ||
      environment.RESOLVE_REVIEWER_KEY.length < 32 ||
      environment.RESOLVE_API_KEY === environment.RESOLVE_REVIEWER_KEY
    )
      throw new ServiceUnavailableException({ code: 'AGENT_API_NOT_CONFIGURED' });
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers.authorization?.replace(/^Bearer /u, '') ?? '';
    const privileged =
      request.method === 'PUT' ||
      ['execute', 'reconcile', 'savePolicy'].includes(context.getHandler().name);
    if (
      matches(token, environment.RESOLVE_REVIEWER_KEY) ||
      (!privileged && matches(token, environment.RESOLVE_API_KEY))
    )
      return true;
    throw new UnauthorizedException({ code: 'AGENT_ACCESS_DENIED' });
  }
}
