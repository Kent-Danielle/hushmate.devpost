import { createTestApp, truncateAll } from './setup.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;

describe('heads-ups and summary e2e', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let n = 0;

  type Person = { token: string; id: string; name: string };
  let alice: Person; // house owner
  let bob: Person; // housemate
  let carol: Person; // approved member of Maple, but her active house is Birch
  let dave: Person; // owns Birch
  let erin: Person; // not a member of Maple
  let houseId: string;

  const as = (p: Person) => ({ Authorization: `Bearer ${p.token}` });
  const inFuture = (ms = 60 * 60_000) => new Date(Date.now() + ms).toISOString();
  const signUp = async (name: string): Promise<Person> => {
    const i = ++n;
    const res = await request(http)
      .post('/auth/signup')
      .set('Fly-Client-IP', `10.6.0.${i}`)
      .send({ name, email: `${name}${i}@example.com`, password: 'correct horse' });
    expect(res.status).toBe(201);
    return { token: res.body.token, id: res.body.user.id, name };
  };
  const join = async (owner: Person, p: Person, id: string, activate = true) => {
    const joined = await request(http).post(`/houses/${id}/join`).set(as(p));
    expect(joined.status).toBe(201);
    await request(http).post(`/memberships/${joined.body.membershipId}/approve`).set(as(owner)).expect(200);
    if (activate) await request(http).post(`/houses/${id}/activate`).set(as(p)).expect(201);
  };
  const post = (p: Person, body: Record<string, unknown>, id = houseId) =>
    request(http).post(`/houses/${id}/heads-ups`).set(as(p)).send(body);
  type Summary = {
    streakDays: number;
    isDemo: boolean;
    headsUps: { id: string; text: string; at: string; authorName: string }[];
    myAcks: unknown[];
  };
  const summary = async (p: Person, id = houseId) =>
    (await request(http).get(`/houses/${id}/summary`).set(as(p)).expect(200)).body as Summary;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await truncateAll(app);
    alice = await signUp('alice');
    bob = await signUp('bob');
    carol = await signUp('carol');
    dave = await signUp('dave');
    erin = await signUp('erin');
    houseId = (await request(http).post('/houses').set(as(alice)).send({ name: 'Maple' })).body.house.id;
    const birch = await request(http).post('/houses').set(as(dave)).send({ name: 'Birch' }).expect(201);
    await join(alice, bob, houseId);
    await join(alice, carol, houseId);
    await join(dave, carol, birch.body.house.id); // activating Birch moves carol's active house away from Maple
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await prisma.headsUp.deleteMany();
    await prisma.nudge.deleteMany();
    await prisma.house.update({ where: { id: houseId }, data: { createdAt: new Date(), isDemo: false } });
  });

  describe('POST /houses/:id/heads-ups', () => {
    it('201 returns the heads-up, and a housemate sees it in GET summary with authorName', async () => {
      const at = inFuture();
      const res = await post(alice, { text: 'Friends over tonight', at });
      expect(res.status).toBe(201);
      expect(res.body.headsUp).toEqual({
        id: expect.any(String),
        text: 'Friends over tonight',
        at: new Date(at).toISOString(),
        authorName: 'alice',
      });
      const seen = await summary(bob);
      expect(seen.headsUps).toEqual([res.body.headsUp]);
      expect((await summary(alice)).headsUps).toEqual([res.body.headsUp]);
    });

    it('trims the text', async () => {
      const res = await post(alice, { text: '   padded   ', at: inFuture() });
      expect(res.status).toBe(201);
      expect(res.body.headsUp.text).toBe('padded');
    });

    it('accepts exactly 200 characters', async () => {
      const res = await post(alice, { text: 'a'.repeat(200), at: inFuture() });
      expect(res.status).toBe(201);
      expect(res.body.headsUp.text).toHaveLength(200);
    });

    it('a 201-character heads-up is 400 and nothing is stored', async () => {
      const res = await post(alice, { text: 'a'.repeat(201), at: inFuture() });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('text must be shorter than or equal to 200 characters');
      expect(await prisma.headsUp.count()).toBe(0);
    });

    it('whitespace-only or empty text is 400', async () => {
      for (const text of ['   ', '', '\n\t ']) {
        const res = await post(alice, { text, at: inFuture() });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.message)).toContain('text must be longer than or equal to 1 characters');
      }
      expect((await post(alice, { at: inFuture() })).status).toBe(400);
      expect(await prisma.headsUp.count()).toBe(0);
    });

    it('a past `at` is 400', async () => {
      const res = await post(alice, { text: 'Too late', at: new Date(Date.now() - 60_000).toISOString() });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('at must be in the future');
      expect(await prisma.headsUp.count()).toBe(0);
    });

    it('`at` of right now is 400 (the future is strict)', async () => {
      const res = await post(alice, { text: 'Now', at: new Date().toISOString() });
      expect(res.status).toBe(400);
    });

    it('a malformed or missing `at` is 400', async () => {
      for (const at of ['tomorrow', '2999-13-45T10:00:00Z', 12345, '']) {
        expect((await post(alice, { text: 'Bad time', at })).status).toBe(400);
      }
      expect((await post(alice, { text: 'No time' })).status).toBe(400);
      expect(await prisma.headsUp.count()).toBe(0);
    });

    it('an unknown extra field is 400', async () => {
      const res = await post(alice, { text: 'Hi', at: inFuture(), authorId: bob.id });
      expect(res.status).toBe(400);
      expect(await prisma.headsUp.count()).toBe(0);
    });

    it('a member whose active house is elsewhere gets 403', async () => {
      const res = await post(carol, { text: 'Wrong house', at: inFuture() });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('This is not your active house');
      expect(await prisma.headsUp.count()).toBe(0);
    });

    it('a non-member gets 403', async () => {
      const res = await post(erin, { text: 'Intruder', at: inFuture() });
      expect(res.status).toBe(403);
      expect(await prisma.headsUp.count()).toBe(0);
    });

    it('a non-UUID house id is 404', async () => {
      expect((await post(alice, { text: 'x', at: inFuture() }, 'not-a-uuid')).status).toBe(404);
    });

    it('requires sign-in', async () => {
      await request(http).post(`/houses/${houseId}/heads-ups`).send({ text: 'x', at: inFuture() }).expect(401);
      await request(http).get(`/houses/${houseId}/summary`).expect(401);
    });

    it('a demo user can post a heads-up', async () => {
      await prisma.user.update({ where: { id: bob.id }, data: { isDemo: true } });
      try {
        const res = await post(bob, { text: 'Demo says hi', at: inFuture() });
        expect(res.status).toBe(201);
        expect(res.body.headsUp.authorName).toBe('bob');
      } finally {
        await prisma.user.update({ where: { id: bob.id }, data: { isDemo: false } });
      }
    });
  });

  describe('GET /houses/:id/summary', () => {
    it('shows only upcoming heads-ups, soonest first; ones whose time has passed drop out', async () => {
      const now = Date.now();
      const mk = (text: string, offset: number, authorId = alice.id) =>
        prisma.headsUp.create({ data: { houseId, authorId, text, at: new Date(now + offset) } });
      await mk('later', 3 * 60 * 60_000, bob.id);
      await mk('gone', -60_000);
      await mk('soon', 30 * 60_000);
      await mk('middle', 2 * 60 * 60_000);
      await mk('long gone', -2 * DAY);

      const s = await summary(carol, houseId);
      expect(s.headsUps.map((h) => h.text)).toEqual(['soon', 'middle', 'later']);
      expect(s.headsUps.map((h) => h.authorName)).toEqual(['alice', 'alice', 'bob']);
      expect(await prisma.headsUp.count()).toBe(5); // nothing is deleted
    });

    it('a heads-up posted over HTTP then moved into the past drops out', async () => {
      const res = await post(alice, { text: 'Brief', at: inFuture(60_000) });
      expect(res.status).toBe(201);
      expect((await summary(bob)).headsUps).toHaveLength(1);
      await prisma.headsUp.update({ where: { id: res.body.headsUp.id }, data: { at: new Date(Date.now() - 1000) } });
      expect((await summary(bob)).headsUps).toEqual([]);
    });

    it('a non-member cannot read the summary', async () => {
      await request(http).get(`/houses/${houseId}/summary`).set(as(erin)).expect(403);
    });

    it('a member whose active house is elsewhere can still read it', async () => {
      const s = await summary(carol, houseId);
      expect(s.isDemo).toBe(false);
    });
  });

  describe('Quiet Streak', () => {
    it('counts whole days since the house was created when there has never been a nudge', async () => {
      await prisma.house.update({ where: { id: houseId }, data: { createdAt: new Date(Date.now() - 5 * DAY) } });
      const { streakDays } = await summary(bob);
      // 5 x 24h back is 5 Vancouver calendar days, or 4/6 across a DST boundary near midnight.
      expect(streakDays).toBeGreaterThanOrEqual(4);
      expect(streakDays).toBeLessThanOrEqual(6);
    });

    it('is 0 for a house created today', async () => {
      expect((await summary(bob)).streakDays).toBe(0);
    });

    it('is 0 right after a nudge, even in a long-quiet house', async () => {
      await prisma.house.update({ where: { id: houseId }, data: { createdAt: new Date(Date.now() - 30 * DAY) } });
      expect((await summary(bob)).streakDays).toBeGreaterThan(20);
      await request(http).post('/nudges').set(as(alice)).send({ recipientId: bob.id }).expect(201);
      expect((await summary(alice)).streakDays).toBe(0);
      expect((await summary(bob)).streakDays).toBe(0);
    });

    it('counts from the latest nudge, not the house creation or an older nudge', async () => {
      await prisma.house.update({ where: { id: houseId }, data: { createdAt: new Date(Date.now() - 30 * DAY) } });
      await request(http).post('/nudges').set(as(alice)).send({ recipientId: bob.id }).expect(201);
      // An older nudge, 20 days back, plus the real one moved back 5 days.
      await prisma.nudge.updateMany({ data: { createdAt: new Date(Date.now() - 5 * DAY) } });
      await prisma.nudge.create({
        data: { houseId, senderId: alice.id, recipientId: bob.id, messageIndex: 0, createdAt: new Date(Date.now() - 20 * DAY) },
      });
      const { streakDays } = await summary(bob);
      expect(streakDays).toBeGreaterThanOrEqual(4);
      expect(streakDays).toBeLessThanOrEqual(6);
    });

    it('the demo house always reports 10', async () => {
      await prisma.house.update({ where: { id: houseId }, data: { isDemo: true } });
      await request(http).post('/nudges').set(as(alice)).send({ recipientId: bob.id }).expect(201);
      const s = await summary(bob);
      expect(s.isDemo).toBe(true);
      expect(s.streakDays).toBe(10);
    });

    it('never names anyone: the summary carries no sender fields', async () => {
      await request(http).post('/nudges').set(as(alice)).send({ recipientId: bob.id }).expect(201);
      const res = await request(http).get(`/houses/${houseId}/summary`).set(as(carol)).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(['headsUps', 'isDemo', 'myAcks', 'streakDays']);
      expect(res.body.streakDays).toBe(0);
      expect(JSON.stringify(res.body)).not.toMatch(/sender|recipient/i);
      expect(res.body.myAcks).toEqual([]); // unacknowledged, and carol is not the sender
    });
  });
});
