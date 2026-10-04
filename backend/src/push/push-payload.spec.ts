import { buildEnvelope, buildSendOptions } from './push-payload.js';

describe('push payload', () => {
  it('builds the declarative envelope', () => {
    expect(buildEnvelope({ kind: 'nudge', body: 'Quiet please', navigate: 'https://x.test/schedule' })).toEqual({
      web_push: 8030,
      mutable: true,
      notification: {
        title: 'Hushmate',
        body: 'Quiet please',
        navigate: 'https://x.test/schedule',
        tag: 'nudge',
        lang: 'en',
        data: { type: 'nudge' },
      },
    });
  });

  it('uses exact option keys per kind', () => {
    expect(buildSendOptions('nudge')).toEqual({ TTL: 1800, urgency: 'high', topic: 'nudge', timeout: 10000 });
    expect(buildSendOptions('join-approved')).toEqual({
      TTL: 86400,
      urgency: 'normal',
      topic: 'join-approved',
      timeout: 10000,
    });
  });
});
