import { expect, it } from 'vitest';
import { parseMention } from './mention';
const body = {
  event_id: 'E1',
  team_id: 'T1',
  event: {
    type: 'app_mention',
    text: '<@B123> Please help #human-only',
    user: 'U1',
    channel: 'C1',
    ts: '1',
  },
};
it('accepts only approved workspaces and channels', () => {
  expect(parseMention(body, 'T2', 'C1')).toBeNull();
  expect(parseMention(body, 'T1', 'C2')).toBeNull();
  expect(parseMention({ ...body, event: { ...body.event, bot_id: 'B1' } }, 'T1', 'C1')).toBeNull();
});
it('deduplicates repeated events and retains human-only preference', () => {
  const request = parseMention(body, 'T1', 'C1');
  expect(request?.id).toBe(parseMention(body, 'T1', 'C1')?.id);
  expect(request?.id).not.toBe(parseMention({ ...body, event_id: 'E2' }, 'T1', 'C1')?.id);
  expect(request?.message).toBe('Please help #human-only');
  expect(request?.aiPreference).toBe('human_only');
});
