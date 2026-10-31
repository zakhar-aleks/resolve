import { createHash } from 'node:crypto';
import { z } from 'zod';
const mentionSchema = z.object({
  event_id: z.string(),
  team_id: z.string(),
  event: z.object({
    type: z.literal('app_mention'),
    text: z.string().max(20000),
    user: z.string(),
    channel: z.string(),
    ts: z.string(),
    bot_id: z.string().optional(),
  }),
});
export function parseMention(payload: unknown, workspaceId: string, channelIds: string) {
  const parsed = mentionSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { event, team_id, event_id } = parsed.data;
  if (
    team_id !== workspaceId ||
    !channelIds
      .split(',')
      .map((id) => id.trim())
      .includes(event.channel) ||
    event.bot_id
  )
    return null;
  const id = `slack_${createHash('sha256').update(`${team_id}:${event_id}`).digest('hex').slice(0, 32)}`;
  const message = event.text
    .replace(/<@[A-Z0-9]+>/gu, '')
    .trim()
    .slice(0, 4000);
  if (!message) return null;
  return {
    id,
    message,
    aiPreference: message.includes('#human-only') ? ('human_only' as const) : ('allowed' as const),
  };
}
