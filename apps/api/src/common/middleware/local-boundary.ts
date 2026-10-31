import { requestLimits } from './request-limits';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
export function localBoundary(port: number, origin: string, internalToken: string) {
  const allowRequest = requestLimits(600);
  const allowIntake = requestLimits(20);
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return (request: Request, response: Response, next: NextFunction): void => {
    if (
      !hosts.has(request.headers.host ?? '') ||
      (request.headers.origin !== undefined && request.headers.origin !== origin)
    ) {
      response
        .status(403)
        .json({ code: 'REQUEST_REJECTED', message: 'Cross-origin access rejected.' });
      return;
    }
    if (
      !allowRequest() ||
      (request.method === 'POST' &&
        ['/api/intake', '/api/v1/agent/messages'].includes(request.path) &&
        !allowIntake())
    ) {
      response.setHeader('Retry-After', '60');
      response.status(429).json({ code: 'RATE_LIMITED' });
      return;
    }
    const agent = request.path === '/api/v1/agent' || request.path.startsWith('/api/v1/agent/');
    const supplied = request.headers['x-resolve-internal'];
    if (
      !agent &&
      (internalToken.length < 32 ||
        typeof supplied !== 'string' ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(internalToken) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(internalToken)))
    ) {
      response.status(401).json({ code: 'OPERATOR_ACCESS_DENIED' });
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  };
}
