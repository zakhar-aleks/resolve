import { COPY } from '../consts/copy';
import { interpolate } from '../utils/interpolate';
import { formatCount, formatInteger } from '../utils/format';
const text = COPY.text;
export const copyText = {
  days: (count: number) =>
    interpolate(text.duration, { count, unit: count === 1 ? text.day : text.days }),
  age: (count: number) => interpolate(text.age, { duration: copyText.days(count) }),
  count: formatCount,
  characters: (count: number) => interpolate(text.characters, { count: formatInteger(count) }),
  refund: (amount: string) => interpolate(text.refund, { amount }),
  eligible: (amount: string) => interpolate(text.eligible, { amount }),
  refundVerified: (amount: string, simulated: boolean) =>
    interpolate(text.refundVerified, {
      amount,
      provider: simulated ? text.simulatorProvider : text.stripeProvider,
    }),
  refundReply: (name: string, amount: string, agent: string, company: string) =>
    interpolate(text.refundReply, { name, amount, agent, company }),
  cancelReply: (name: string, agent: string, company: string) =>
    interpolate(text.cancelReply, { name, agent, company }),
  policySummary: (company: string, duplicates: boolean, review: boolean) =>
    interpolate(text.policySummary, {
      company,
      duplicateRule: duplicates ? text.duplicateRule : text.standardRule,
      reviewRule: review ? text.reviewRule : text.operatorRule,
    }),
  window: (days: number) => interpolate(text.window, { days }),
  limit: (amount: string) => interpolate(text.limit, { amount }),
  elapsed: (ms: number) => interpolate(text.elapsed, { ms }),
  source: (name: string) => (name === 'rules' ? text.sourceRules : name),
  score: (value: number | null) =>
    value === null ? COPY.support.unscored : interpolate(text.score, { score: value.toFixed(2) }),
  percentage: (value: number) => interpolate(text.percentage, { value: Math.round(value * 100) }),
};
