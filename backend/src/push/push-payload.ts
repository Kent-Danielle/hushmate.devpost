export type PushKind = 'nudge' | 'join-approved';

export interface PushMessage {
  kind: PushKind;
  body: string;
  /** Absolute URL the notification opens. */
  navigate: string;
}

export interface DeclarativeEnvelope {
  web_push: 8030;
  mutable: true;
  notification: {
    title: 'Hushmate';
    body: string;
    navigate: string;
    tag: PushKind;
    lang: 'en';
    data: { type: PushKind };
  };
}

/** The declarative Web Push envelope: the same bytes for every browser. */
export function buildEnvelope(message: PushMessage): DeclarativeEnvelope {
  return {
    web_push: 8030,
    mutable: true,
    notification: {
      title: 'Hushmate',
      body: message.body,
      navigate: message.navigate,
      tag: message.kind,
      lang: 'en',
      data: { type: message.kind },
    },
  };
}

export interface SendOptions {
  TTL: number;
  urgency: 'high' | 'normal';
  topic: string;
  timeout: number;
}

/** Option keys are exact: web-push throws on unknown ones (`TTL`, not `ttl`). */
export function buildSendOptions(kind: PushKind): SendOptions {
  return kind === 'nudge'
    ? { TTL: 1800, urgency: 'high', topic: 'nudge', timeout: 10000 }
    : { TTL: 86400, urgency: 'normal', topic: 'join-approved', timeout: 10000 };
}
