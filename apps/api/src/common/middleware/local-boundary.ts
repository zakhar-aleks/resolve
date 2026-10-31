import type { NextFunction, Request, Response } from 'express';
export function localBoundary(port: number, origin: string) {
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
    next();
  };
}
