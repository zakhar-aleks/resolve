import type { z } from 'zod';
export class ProviderError extends Error {
  constructor(readonly status: number | null) {
    super('PROVIDER_UNAVAILABLE');
  }
}
export async function requestJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(25000) });
  } catch {
    throw new ProviderError(null);
  }
  if (!response.ok) throw new ProviderError(response.status);
  const data: unknown = await response.json();
  const result = schema.safeParse(data);
  if (!result.success) throw new ProviderError(response.status);
  return result.data;
}
