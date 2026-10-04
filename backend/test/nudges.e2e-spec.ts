import { createTestApp, truncateAll } from './setup.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import webpush from 'web-push';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NUDGE_MESSAGES } from '../src/nudges/messages.js';

vi.mock('web-push', () => {
  const mock = { setVapidDetails: vi.fn(), sendNotification: vi.fn() };
  return { default: mock, ...mock };
});

// Bot bullets ("a bot ack after 60 s", "bot nudges skip the cooldown") belong to build slice 7 (Demo module).

describe('nudges e2e (the kernel)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let n = 0;

  type Person = { token: string; id: string; name: string };
  let alice: Person; // house owner
  let bob: Person;
  let carol: Person;
  let dave: Person; // owns a different house, so a different active house
  let houseId: string;

  const as = (p: Person) => ({ Authorization: `Bearer ${p.token}` });
  const signUp = async (name: string): Promise<Person> => {
    const i = ++n;
    const res = await request(http)
      .post('/auth/signup')
      .set('Fly-Client-IP', `10.4.0.${i}`)
      .send({ name, email: `${name}${i}@example.com`, password: 'correct horse' });
    expect(res.status).toBe(201);
    return { token: res.body.token, id: res.body.user.id, name };
  };
  const join = async (owner: Person, p: Person, id: string) => {
    const joined = await request(http).post(`/houses/${id}/join`).set(as(p));
    expect(joined.status).toBe(201);
    await request(http).post(`/memberships/${joined.body.membershipId}/approve`).set(as(owner)).expect(200);
    await request(http).post(`/houses/${id}/activate`).set(as(p)).expect(201);
  };
  const nudge = (from: Person, to: Person) => request(http).post('/nudges').set(as(from)).send({ recipientId: to.id });
  const pending = async (p: Person) => (await request(http).get('/nudges/pending').set(as(p)).expect(200)).body as Record<string, unknown>[];
  const summary = async (p: Person) =>
    (await request(http).get(`/houses/${houseId}/summary`).set(as(p)).expect(200)).body as {
      streakDays: number;
      myAcks: { nudgeId: string; recipientName: string; acknowledgedAt: string }[];
    };
  const clearNudges = () => prisma.nudge.deleteMany();

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await truncateAll(app);
    alice = await signUp('alice');
    bob = await signUp('bob');
    carol = await signUp('carol');
    dave = await signUp('dave');
    const house = await request(http).post('/houses').set(as(alice)).send({ name: 'Maple' });
    houseId = house.body.house.id;
    await request(http).post('/houses').set(as(dave)).send({ name: 'Birch' }).expect(201);
    await join(alice, bob, houseId);
    await join(alice, carol, houseId);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await clearNudges();
    vi.mocked(webpush.sendNotification).mockReset();
  });

  it('cooldown: the second nudge within 5 minutes is 429 with cooldownUntil', async () => {
    const first = await nudge(alice, bob);
    expect(first.status).toBe(201);
    const until = new Date(first.body.cooldownUntil).getTime();
    expect(until - Date.now()).toBeGreaterThan(4 * 60_000);
    expect(until - Date.now()).toBeLessThanOrEqual(5 * 60_000);

    const second = await nudge(alice, carol);
    expect(second.status).toBe(429);
    expect(second.body.cooldownUntil).toBe(first.body.cooldownUntil);
    expect(second.body.statusCode).toBe(429);
    expect(await prisma.nudge.count()).toBe(1);
  });

  it('GET /me.nudgeCooldownUntil is null before a nudge and the cooldown end after', async () => {
    const before = await request(http).get('/me').set(as(alice)).expect(200);
    expect(before.body.nudgeCooldownUntil).toBeNull();
    const sent = await nudge(alice, bob);
    const after = await request(http).get('/me').set(as(alice)).expect(200);
    expect(after.body.nudgeCooldownUntil).toBe(sent.body.cooldownUntil);
    const recipient = await request(http).get('/me').set(as(bob)).expect(200);
    expect(recipient.body.nudgeCooldownUntil).toBeNull();
  });

  it('the cooldown ends after 5 minutes', async () => {
    await nudge(alice, bob).expect(201);
    await prisma.nudge.updateMany({ data: { createdAt: new Date(Date.now() - 5 * 60_000 - 1000) } });
    await nudge(alice, bob).expect(201);
    const me = await request(http).get('/me').set(as(alice)).expect(200);
    expect(new Date(me.body.nudgeCooldownUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it('pending never contains the sender and carries no sender fields', async () => {
    await nudge(alice, bob).expect(201);
    const forBob = await pending(bob);
    expect(forBob).toHaveLength(1);
    expect(Object.keys(forBob[0]).sort()).toEqual(['createdAt', 'id', 'isDemo', 'message', 'subtitle']);
    expect(NUDGE_MESSAGES as readonly string[]).toContain(forBob[0].message);
    expect(forBob[0].subtitle).toBeNull();
    expect(forBob[0].isDemo).toBe(false);
    const raw = JSON.stringify(forBob);
    expect(raw).not.toContain(alice.id);
    expect(raw.toLowerCase()).not.toContain('alice');
    expect(await pending(alice)).toEqual([]);
    expect(await pending(carol)).toEqual([]);
  });

  it('only the sender sees acknowledgements', async () => {
    await nudge(alice, bob).expect(201);
    const ack = await request(http).post('/nudges/acknowledge').set(as(bob)).expect(200);
    expect(ack.body).toEqual({ acknowledged: 1 });

    const mine = await summary(alice);
    expect(mine.myAcks).toHaveLength(1);
    expect(mine.myAcks[0].recipientName).toBe('bob');
    expect((await summary(bob)).myAcks).toEqual([]);
    expect((await summary(carol)).myAcks).toEqual([]);
  });

  it('acknowledge clears pending, and an unacknowledged nudge is not an ack', async () => {
    await nudge(alice, bob).expect(201);
    expect((await summary(alice)).myAcks).toEqual([]);
    expect(await pending(bob)).toHaveLength(1);
    const ack = await request(http).post('/nudges/acknowledge').set(as(bob)).expect(200);
    expect(ack.body.acknowledged).toBe(1);
    expect(await pending(bob)).toEqual([]);
    const again = await request(http).post('/nudges/acknowledge').set(as(bob)).expect(200);
    expect(again.body.acknowledged).toBe(0);
  });

  it('a nudge across different active houses is 403 and nothing is stored', async () => {
    const res = await nudge(alice, dave);
    expect(res.status).toBe(403);
    expect((await nudge(dave, alice)).status).toBe(403);
    expect(await prisma.nudge.count()).toBe(0);
  });

  it('403 also when the recipient is a member whose active house is another one', async () => {
    await request(http).post(`/houses/${(await prisma.house.findFirstOrThrow({ where: { name: 'Birch' } })).id}/activate`).set(as(carol)).expect(403);
    await prisma.user.update({ where: { id: carol.id }, data: { activeHouseId: null } });
    expect((await nudge(alice, carol)).status).toBe(403);
    await prisma.user.update({ where: { id: carol.id }, data: { activeHouseId: houseId } });
  });

  it('a self-nudge is 403, and 403 is checked before the cooldown', async () => {
    expect((await nudge(alice, alice)).status).toBe(403);
    await nudge(alice, bob).expect(201);
    expect((await nudge(alice, alice)).status).toBe(403);
    expect((await nudge(alice, dave)).status).toBe(403);
  });

  it('a bad recipient id is 400, and nudging requires sign-in', async () => {
    await request(http).post('/nudges').set(as(alice)).send({ recipientId: 'nope' }).expect(400);
    await request(http).post('/nudges').send({ recipientId: bob.id }).expect(401);
    await request(http).get('/nudges/pending').expect(401);
  });

  it('streakDays is 0 right after a nudge', async () => {
    await nudge(alice, bob).expect(201);
    expect((await summary(carol)).streakDays).toBe(0);
  });

  it('pushes the nudge to the recipient with no sender identity anywhere in the payload', async () => {
    await prisma.pushSubscription.deleteMany();
    await request(http)
      .post('/push/subscriptions')
      .set(as(bob))
      .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/nudge-e2e', keys: { p256dh: 'k', auth: 'a' } })
      .expect(201);
    await nudge(alice, bob).expect(201);
    await vi.waitFor(() => expect(webpush.sendNotification).toHaveBeenCalledTimes(1));

    const [subscription, body, options] = vi.mocked(webpush.sendNotification).mock.calls[0] as unknown as [
      { endpoint: string },
      string,
      Record<string, unknown>,
    ];
    expect(subscription.endpoint).toBe('https://fcm.googleapis.com/fcm/send/nudge-e2e');
    const all = JSON.stringify({ body, options }).toLowerCase();
    expect(all).not.toContain(alice.id.toLowerCase());
    expect(all).not.toContain('alice');
    expect(options).not.toHaveProperty('topic');
    expect(JSON.parse(body).notification.tag).toBe('nudge');
    await prisma.pushSubscription.deleteMany();
  });
});
