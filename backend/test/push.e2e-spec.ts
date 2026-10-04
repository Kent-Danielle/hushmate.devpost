import { createTestApp, truncateAll } from './setup.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import webpush from 'web-push';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PushService } from '../src/push/push.service.js';

vi.mock('web-push', () => {
  const mock = { setVapidDetails: vi.fn(), sendNotification: vi.fn() };
  return { default: mock, ...mock };
});

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-device-1';
const KEYS = { p256dh: 'p256dh-key', auth: 'auth-secret' };

describe('push e2e', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let idA: string;
  let idB: string;
  let n = 0;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await truncateAll(app);
    const signUp = async (name: string) => {
      const res = await request(http)
        .post('/auth/signup')
        .set('Fly-Client-IP', `10.1.0.${++n}`)
        .send({ name, email: `${name}@example.com`, password: 'correct horse' });
      expect(res.status).toBe(201);
      return { token: res.body.token as string, id: res.body.user.id as string };
    };
    ({ token: tokenA, id: idA } = await signUp('alice'));
    ({ token: tokenB, id: idB } = await signUp('bob'));
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    vi.mocked(webpush.sendNotification).mockReset();
    await prisma.pushSubscription.deleteMany();
  });

  const subscribe = (token: string, endpoint: string) =>
    request(http).post('/push/subscriptions').set('Authorization', `Bearer ${token}`).send({ endpoint, keys: KEYS });

  it('GET /push/vapid-public-key is public and returns {key}', async () => {
    const res = await request(http).get('/push/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body.key).toBe(process.env.VAPID_PUBLIC_KEY);
  });

  it('subscribing requires sign-in', async () => {
    const res = await request(http).post('/push/subscriptions').send({ endpoint: ENDPOINT, keys: KEYS });
    expect(res.status).toBe(401);
  });

  it('an unknown push host returns 400', async () => {
    for (const endpoint of ['https://evil.example.com/push/abc', 'http://fcm.googleapis.com/fcm/send/x']) {
      const res = await subscribe(tokenA, endpoint);
      expect(res.status).toBe(400);
    }
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('a known push host is stored (201)', async () => {
    const res = await subscribe(tokenA, ENDPOINT);
    expect(res.status).toBe(201);
    const row = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: ENDPOINT } });
    expect(row.userId).toBe(idA);
  });

  it('upsert by endpoint reassigns the row to the caller', async () => {
    await subscribe(tokenA, ENDPOINT);
    const res = await subscribe(tokenB, ENDPOINT);
    expect(res.status).toBe(201);
    const rows = await prisma.pushSubscription.findMany({ where: { endpoint: ENDPOINT } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(idB);
  });

  it('DELETE removes only the caller\'s own subscription (204)', async () => {
    await subscribe(tokenA, ENDPOINT);
    const other = await request(http)
      .delete('/push/subscriptions')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ endpoint: ENDPOINT });
    expect(other.status).toBe(204);
    expect(await prisma.pushSubscription.count()).toBe(1);

    const own = await request(http)
      .delete('/push/subscriptions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ endpoint: ENDPOINT });
    expect(own.status).toBe(204);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('a 410 from the push service deletes the row', async () => {
    const gone = 'https://fcm.googleapis.com/fcm/send/gone';
    await subscribe(tokenA, ENDPOINT);
    await subscribe(tokenA, gone);
    vi.mocked(webpush.sendNotification).mockImplementation(async (sub) => {
      if (sub.endpoint === gone) throw Object.assign(new Error('Gone'), { statusCode: 410 });
      return { statusCode: 201, body: '', headers: {} };
    });

    await app.get(PushService).sendToUser(idA, { kind: 'nudge', body: 'Hi', navigate: 'http://localhost/schedule' });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    const endpoints = (await prisma.pushSubscription.findMany()).map((r) => r.endpoint);
    expect(endpoints).toEqual([ENDPOINT]);
  });

  it('a 403 from the push service keeps the row (VAPID config error)', async () => {
    await subscribe(tokenA, ENDPOINT);
    vi.mocked(webpush.sendNotification).mockRejectedValue(Object.assign(new Error('bad'), { statusCode: 403 }));
    await app.get(PushService).sendToUser(idA, { kind: 'nudge', body: 'Hi', navigate: 'http://localhost/schedule' });
    expect(await prisma.pushSubscription.count()).toBe(1);
  });
});
