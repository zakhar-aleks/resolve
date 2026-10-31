import type { z } from 'zod';
import { ErrorSchema } from '@resolve/contracts';
export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const base = import.meta.env.API_URL ?? 'http://127.0.0.1:8788/api';
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError('API_UNAVAILABLE');
  }
  const value: unknown = await response.json();
  if (!response.ok) {
    const parsed = ErrorSchema.safeParse(value);
    throw new ApiError(parsed.success ? parsed.data.code : 'UNKNOWN');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('INTERNAL_ERROR');
  return parsed.data;
}
