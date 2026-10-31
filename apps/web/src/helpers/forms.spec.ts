import { describe, it, expect } from 'vitest';
import { cents, companyForm } from './forms';
import { interpolate } from '../utils/interpolate';
import { readPolicyFile } from '../utils/read-policy-file';
describe('typed frontend boundaries', () => {
  it.each([
    ['0.01', 1],
    ['29', 2900],
    ['29.1', 2910],
    ['10000.00', 1000000],
  ])('maps exact currency %s without floating point rounding', (input, expected) => {
    expect(cents(input)).toBe(expected);
  });
  it.each(['-1', '1.001', '1e3', '', 'NaN'])('rejects ambiguous currency %s', (input) => {
    expect(cents(input)).toBeNaN();
  });
  it('rejects incomplete company forms at the frontend boundary', () => {
    expect(() => companyForm(new FormData())).toThrow();
  });
  it('interpolates templates without evaluating code', () => {
    expect(interpolate('Hi {name}', { name: '<script>alert(1)</script>' })).toBe(
      'Hi <script>alert(1)</script>',
    );
  });
  it('limits policy document formats', async () => {
    await expect(readPolicyFile(new File(['policy'], 'policy.pdf'))).rejects.toThrow();
    expect(await readPolicyFile(new File(['Review annual plans.'], 'policy.md'))).toBe(
      'Review annual plans.',
    );
  });
});
