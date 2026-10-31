import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
// Server-only runtime configuration: secrets must never be embedded in client bundles.
for (const path of [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')]) {
  try {
    loadEnvFile(path);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}
export function serverEnvironment(name: string): string {
  return process.env[name] ?? '';
}
