import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { environment } from '../config/environment';
import { workspaceContext } from '../tenancy/context';
import { encrypt, decrypt } from './encryption';
const original = environment.DATA_ENCRYPTION_KEY;
beforeEach(() => {
  environment.DATA_ENCRYPTION_KEY = 'ab'.repeat(32);
});
afterEach(() => {
  environment.DATA_ENCRYPTION_KEY = original;
});
describe('authenticated encrypted storage', () => {
  it('encrypts with random nonces and rejects tampering or field substitution', () => {
    const value = { message: 'Private customer content' };
    const first = encrypt(value, 'cases.message'),
      second = encrypt(value, 'cases.message');
    expect(first).not.toBe(second);
    expect(first).not.toContain(value.message);
    expect(decrypt(first, 'cases.message')).toEqual(value);
    expect(() => decrypt(first, 'other.field')).toThrow();
    const parts = first.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'), 'cases.message')).toThrow();
  });
  it('derives different keys for each company and fails closed without a key', () => {
    const data = new DataSource({ type: 'postgres', url: 'postgresql://unused' });
    const inCompany = (id: string, action: () => unknown) =>
      workspaceContext.run({ id, data, secrets: {}, role: 'owner' }, action);
    const ciphertext = inCompany('company-one', () => encrypt('private', 'message'));
    expect(inCompany('company-one', () => decrypt(ciphertext, 'message'))).toBe('private');
    expect(() => inCompany('company-two', () => decrypt(ciphertext, 'message'))).toThrow();
    environment.DATA_ENCRYPTION_KEY = '';
    expect(() => encrypt('private', 'message')).toThrow();
  });
});
