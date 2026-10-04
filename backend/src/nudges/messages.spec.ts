import { describe, expect, it } from 'vitest';
import { buildEnvelope, buildSendOptions } from '../push/push-payload.js';
import { DEMO_SUBTITLE, NUDGE_MESSAGES, messageFor, pushBody } from './messages.js';

describe('nudge messages', () => {
  it('has five messages with no sender wording', () => {
    expect(NUDGE_MESSAGES).toHaveLength(5);
    expect(messageFor(2)).toBe(NUDGE_MESSAGES[2]);
  });
  it('adds the subtitle on a new line only for demo nudges', () => {
    expect(pushBody(0, false)).toBe(NUDGE_MESSAGES[0]);
    expect(pushBody(0, true)).toBe(`${NUDGE_MESSAGES[0]}\n${DEMO_SUBTITLE}`);
  });
  it('builds the declarative nudge envelope and exact send options', () => {
    const env = buildEnvelope({ kind: 'nudge', body: pushBody(1, true), navigate: 'https://x.test/schedule' });
    expect(env).toMatchObject({
      web_push: 8030,
      mutable: true,
      notification: { title: 'Hushmate', navigate: 'https://x.test/schedule', tag: 'nudge', lang: 'en', data: { type: 'nudge' } },
    });
    expect(env.notification.body).toContain(DEMO_SUBTITLE);
    expect(buildSendOptions('nudge')).toEqual({ TTL: 1800, urgency: 'high', timeout: 10000 });
  });
});
