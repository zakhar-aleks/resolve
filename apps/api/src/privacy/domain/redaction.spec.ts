import { describe, expect, it } from 'vitest';
import { redactIdentifiers } from './redaction';
import { DEFAULT_PRIVACY, PrivacyProfileSchema } from '@resolve/contracts';
describe('privacy boundaries', () => {
  it('removes common contact and payment identifiers while retaining the request', () => {
    const result = redactIdentifiers(
      'Refund my duplicate charge. Email me at customer@example.com or +380 67 123 4567. Card 4242 4242 4242 4242.',
    );
    expect(result).toContain('Refund my duplicate charge');
    expect(result).not.toContain('customer@example.com');
    expect(result).not.toContain('123 4567');
    expect(result).not.toContain('4242');
  });
  it('requires accountable evidence for a confirmed readiness task', () => {
    const tasks = DEFAULT_PRIVACY.tasks.map((task) => ({
      ...task,
      confirmed: task.id === 'scope',
    }));
    expect(PrivacyProfileSchema.safeParse({ ...DEFAULT_PRIVACY, tasks }).success).toBe(false);
  });
  it('has no setting that waives GDPR obligations', () => {
    expect(PrivacyProfileSchema.safeParse({ ...DEFAULT_PRIVACY, gdprOptOut: true }).success).toBe(
      false,
    );
  });
});
