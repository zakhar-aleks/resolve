import {
  CompanyInputSchema,
  CreateCaseSchema,
  ConnectionInputSchema,
  IdSchema,
  type CompanyProfile,
} from '@resolve/contracts';
export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
function integer(form: FormData, name: string): number {
  const value = text(form, name);
  return /^\d+$/u.test(value) ? Number(value) : Number.NaN;
}
export function cents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/u.test(value)) return Number.NaN;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function companyForm(form: FormData): CompanyProfile {
  return CompanyInputSchema.parse({
    companyName: text(form, 'companyName'),
    agentName: text(form, 'agentName'),
    tone: text(form, 'tone'),
    context: text(form, 'context'),
    writtenPolicy: text(form, 'writtenPolicy'),
    escalationEmail: text(form, 'escalationEmail'),
    refundWindowDays: integer(form, 'refundWindowDays'),
    maximumPaymentCents: cents(text(form, 'maximumPayment')),
    refundsEnabled: form.has('refundsEnabled'),
    cancellationsEnabled: form.has('cancellationsEnabled'),
    duplicateOnly: form.has('duplicateOnly'),
    reviewAll: form.has('reviewAll'),
    decisionEngine: text(form, 'decisionEngine'),
    jevConfidenceThreshold: Number(text(form, 'jevConfidenceThreshold')),
    revision: text(form, 'revision'),
  });
}
export function caseForm(form: FormData) {
  return CreateCaseSchema.parse({
    name: text(form, 'name'),
    title: text(form, 'title'),
    message: text(form, 'message'),
    amountCents: cents(text(form, 'amount')),
    ageDays: integer(form, 'ageDays'),
    reason: text(form, 'reason'),
  });
}
export function connectionForm(form: FormData) {
  return ConnectionInputSchema.parse({ provider: text(form, 'provider'), key: text(form, 'key') });
}
export function idForm(form: FormData, name: string): string {
  return IdSchema.parse(text(form, name));
}
