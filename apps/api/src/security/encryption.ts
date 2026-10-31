import { workspaceContext } from '../tenancy/context';
import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';
import { environment } from '../config/environment';
function encryptionKey(): Buffer {
  const master = Buffer.from(environment.DATA_ENCRYPTION_KEY, 'hex');
  if (master.length !== 32) throw new Error('DATA_ENCRYPTION_KEY is required');
  return Buffer.from(
    hkdfSync(
      'sha256',
      master,
      'resolve-storage-v1',
      workspaceContext.getStore()?.id ?? 'catalogue',
      32,
    ),
  );
}
export function encrypt(value: unknown, context: string): string {
  const key = encryptionKey();
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 64 hexadecimal characters');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [
    'enc1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url'),
  ].join('.');
}
export function decrypt(value: unknown, context: string): unknown {
  if (typeof value !== 'string') throw new Error('Encrypted value required');
  const [version, iv, tag, data] = value.split('.');
  if (version !== 'enc1' || !iv || !tag || !data) throw new Error('Invalid encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString(
      'utf8',
    ),
  ) as unknown;
}
export function encryptedColumn(context: string) {
  return {
    to: (value: unknown) =>
      value === null || value === undefined ? value : encrypt(value, context),
    from: (value: unknown) => (value === null ? null : decrypt(value, context)),
  };
}
