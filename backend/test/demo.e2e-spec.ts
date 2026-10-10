import { createTestApp, truncateAll } from './setup.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DemoService } from '../src/demo/demo.service.js';
import { BOT_HEADS_UPS, DEMO_BOTS, DEMO_HOUSE_CODE, DEMO_HOUSE_NAME, DEMO_JUDGES, LAST_DEMO_RESET_KEY, resetDemoContent, upsertDemoWorld } from '../src/demo/demo-data.js';
import { DEMO_SUBTITLE } from '../src/nudges/messages.js';

vi.mock('web-push', () => {
  const mock = { setVapidDetails: vi.fn(), sendNotification: vi.fn() };
  return { default: mock, ...mock };
});

const PASSWORD = 'demo-test-password';
const MIN = 60_000;

describe('demo e2e (demo house, simulated housemates, nightly reset)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let demo: DemoService;
  let houseId: string;
  let ip = 0;

  const signIn = async (email: string) => {
    const res = await request(http).post('/auth/signin').set('Fly-Client-IP', `10.7.0.${++ip}`).send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return { token: res.body.token as string, id: res.body.user.id as string };
  };
  const bearer = (t: { token: string }) => ({ Authorization: `Bearer ${t.token}` });
  const judgeId = async (n: number) => (await prisma.user.findUniqueOrThrow({ where: { email: DEMO_JUDGES[n]!.email } })).id;
  const botId = async (n: number) => (await prisma.user.findUniqueOrThrow({ where: { email: DEMO_BOTS[n]!.email } })).id;
  const snapshotIds = async () => ({
    users: (await prisma.user.findMany({ select: { id: true }, orderBy: { email: 'asc' } })).map((u) => u.id),
    houses: (await prisma.house.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map((u) => u.id),
    memberships: (await prisma.membership.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map((u) => u.id),
  });

  beforeAll(async () => {
    process.env.DEMO_ACCOUNT_PASSWORD = PASSWORD;
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    demo = app.get(DemoService);
    await truncateAll(app);
    houseId = (await upsertDemoWorld(prisma, { password: PASSWORD })).houseId;
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await prisma.nudge.deleteMany();
    await prisma.user.updateMany({ data: { demoNextNudgeAt: null } });
  });

  it('the demo world is seeded: house 202610 owned by Maya, 3 bots, 5 judges, all approved with setup done', async () => {
    const house = await prisma.house.findUniqueOrThrow({ where: { id: houseId }, include: { owner: true, memberships: true } });
    expect(house.name).toBe(DEMO_HOUSE_NAME);
    expect(house.code).toBe(DEMO_HOUSE_CODE);
    expect(house.isDemo).toBe(true);
    expect(house.owner.email).toBe('maya.bot@example.com');
    expect(house.memberships).toHaveLength(8);
    expect(house.memberships.every((m) => m.status === 'approved' && m.setupDoneAt)).toBe(true);
  });

  describe('reset', () => {
    it('keeps IDs, removes judge content, restores bot content, and a second run is a no-op', async () => {
      const judge = await signIn('judge1@example.com');
      const j1 = await judgeId(0);
      await request(http).post(`/houses/${houseId}/quiet-times`).set(bearer(judge)).send({ days: [2], startMinute: 1320, endMinute: 1380 }).expect(201);
      await prisma.nudge.create({ data: { houseId, senderId: await botId(0), recipientId: j1, messageIndex: 0, isDemo: true } });
      await prisma.nudge.create({ data: { houseId, senderId: j1, recipientId: await botId(1), messageIndex: 0, isDemo: true } });
      // Tamper with bot content: wipe Jordan's quiet times and the heads-ups.
      await prisma.quietTime.deleteMany({ where: { userId: await botId(1) } });
      await prisma.headsUp.deleteMany();
      await prisma.user.update({ where: { id: j1 }, data: { demoNextNudgeAt: new Date() } });
      await prisma.systemState.deleteMany({ where: { key: LAST_DEMO_RESET_KEY } });
      const before = await snapshotIds();

      expect(await resetDemoContent(prisma)).toBe(true);

      expect(await snapshotIds()).toEqual(before);
      expect(await prisma.nudge.count({ where: { houseId } })).toBe(0);
      expect(await prisma.quietTime.count({ where: { userId: j1 } })).toBe(0);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: j1 } })).demoNextNudgeAt).toBeNull();
      expect(await prisma.quietTime.count({ where: { userId: await botId(1) } })).toBeGreaterThan(0);
      // Maya: Sun-Thu (5 rows); Jordan: 7 + Saturday; Priya: 5 weekdays + Fri, Sat.
      expect(await prisma.quietTime.count({ where: { userId: await botId(0) } })).toBe(5);
      expect(await prisma.quietTime.count({ where: { userId: await botId(1) } })).toBe(8);
      expect(await prisma.quietTime.count({ where: { userId: await botId(2) } })).toBe(7);
      const headsUps = await prisma.headsUp.findMany({ where: { houseId }, include: { author: true } });
      expect(headsUps.map((h) => h.text).sort()).toEqual(BOT_HEADS_UPS.map((h) => h.text).sort());

      // Second run: guard says done, nothing changes.
      const stateBefore = await prisma.systemState.findUniqueOrThrow({ where: { key: LAST_DEMO_RESET_KEY } });
      const headsUpIds = headsUps.map((h) => h.id).sort();
      await prisma.nudge.create({ data: { houseId, senderId: j1, recipientId: await botId(1), messageIndex: 0, isDemo: true } });
      expect(await resetDemoContent(prisma)).toBe(false);
      expect(await demo.resetIfOverdue()).toBe(false);
      expect(await prisma.nudge.count({ where: { houseId } })).toBe(1);
      expect((await prisma.headsUp.findMany({ where: { houseId } })).map((h) => h.id).sort()).toEqual(headsUpIds);
      expect((await prisma.systemState.findUniqueOrThrow({ where: { key: LAST_DEMO_RESET_KEY } })).value).toEqual(stateBefore.value);
    });

    it('the overdue check (minute tick) resets when lastDemoResetAt is stale', async () => {
      await prisma.systemState.update({ where: { key: LAST_DEMO_RESET_KEY }, data: { value: new Date(Date.now() - 3 * 24 * 60 * MIN) } });
      expect(await demo.resetIfOverdue()).toBe(true);
      expect(await demo.resetIfOverdue()).toBe(false);
    });

    it('judges can still sign in with the same password and token after a reset', async () => {
      const judge = await signIn('judge2@example.com');
      await prisma.systemState.deleteMany({ where: { key: LAST_DEMO_RESET_KEY } });
      expect(await resetDemoContent(prisma)).toBe(true);
      await request(http).get('/me').set(bearer(judge)).expect(200);
      await signIn('judge2@example.com');
    });
  });

  describe('GET /me for demo accounts', () => {
    it('returns the demo shape and arms demoNextNudgeAt 15-45 seconds ahead, once', async () => {
      const judge = await signIn('judge1@example.com');
      const id = await judgeId(0);
      // Signing in already returns the User shape, which arms; clear it to test GET /me itself.
      await prisma.user.update({ where: { id }, data: { demoNextNudgeAt: null } });

      const t0 = Date.now();
      const res = await request(http).get('/me').set(bearer(judge)).expect(200);
      expect(res.body.isDemo).toBe(true);
      expect(res.body.demo).toEqual({ houseName: DEMO_HOUSE_NAME, botNames: ['Maya', 'Jordan', 'Priya'] });
      expect(res.body.passwordHash).toBeUndefined();

      const armed = (await prisma.user.findUniqueOrThrow({ where: { id } })).demoNextNudgeAt!;
      expect(armed.getTime() - t0).toBeGreaterThanOrEqual(13_000);
      expect(armed.getTime() - Date.now()).toBeLessThanOrEqual(45_000 + 2000);

      await request(http).get('/me').set(bearer(judge)).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id } })).demoNextNudgeAt).toEqual(armed);
    });

    it('a non-demo user gets no demo field and is not armed', async () => {
      const res = await request(http).post('/auth/signup').set('Fly-Client-IP', `10.7.1.${++ip}`).send({ name: 'Real', email: 'real@example.com', password: 'correct horse' });
      const me = await request(http).get('/me').set({ Authorization: `Bearer ${res.body.token}` }).expect(200);
      expect(me.body.isDemo).toBe(false);
      expect(me.body.demo).toBeUndefined();
    });
  });

  describe('simulated housemates', () => {
    it('a due judge gets a demo nudge from a bot on the tick, with the subtitle; the next one is 5-10 min away', async () => {
      const judge = await signIn('judge1@example.com');
      const id = await judgeId(0);
      await prisma.user.update({ where: { id }, data: { demoNextNudgeAt: new Date(Date.now() - 1000) } });
      // Another judge that is not due gets nothing.
      const now = new Date();
      expect(await demo.sendDueBotNudges(now)).toBe(1);

      const list = (await request(http).get('/nudges/pending').set(bearer(judge)).expect(200)).body as Record<string, unknown>[];
      expect(list).toHaveLength(1);
      expect(list[0]!.isDemo).toBe(true);
      expect(list[0]!.subtitle).toBe(DEMO_SUBTITLE);
      expect(list[0]!.subtitle).not.toBeNull();

      const row = await prisma.nudge.findFirstOrThrow({ where: { recipientId: id }, include: { sender: true } });
      expect(row.sender.isBot).toBe(true);
      expect(row.isDemo).toBe(true);

      const next = (await prisma.user.findUniqueOrThrow({ where: { id } })).demoNextNudgeAt!;
      expect(next.getTime() - now.getTime()).toBeGreaterThanOrEqual(5 * MIN);
      expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(10 * MIN);
      // Not due again: a second tick sends nothing.
      expect(await demo.sendDueBotNudges(new Date())).toBe(0);
      expect(await prisma.nudge.count({ where: { recipientId: id } })).toBe(1);
    });

    it('a null demoNextNudgeAt (not armed) gets no nudge', async () => {
      expect(await demo.sendDueBotNudges(new Date())).toBe(0);
      expect(await prisma.nudge.count()).toBe(0);
    });

    it('bot nudges skip the cooldown: two in a row both land', async () => {
      const id = await judgeId(0);
      for (let i = 0; i < 2; i++) {
        await prisma.user.update({ where: { id }, data: { demoNextNudgeAt: new Date(Date.now() - 1000) } });
        expect(await demo.sendDueBotNudges(new Date())).toBe(1);
      }
      const nudges = await prisma.nudge.findMany({ where: { recipientId: id } });
      expect(nudges).toHaveLength(2);
      expect(nudges.every((n) => n.isDemo)).toBe(true);
    });

    it('a bot acks a judge nudge only after 10 s, on the tick', async () => {
      const judge = await signIn('judge1@example.com');
      const maya = await botId(0);
      const sent = await request(http).post('/nudges').set(bearer(judge)).send({ recipientId: maya });
      expect(sent.status).toBe(201);
      const nudgeId = (await prisma.nudge.findFirstOrThrow({ where: { recipientId: maya } })).id;

      expect(await demo.acknowledgeBotNudges(new Date())).toBe(0);
      expect((await prisma.nudge.findUniqueOrThrow({ where: { id: nudgeId } })).acknowledgedAt).toBeNull();
      await prisma.nudge.update({ where: { id: nudgeId }, data: { createdAt: new Date(Date.now() - 5_000) } });
      expect(await demo.acknowledgeBotNudges(new Date())).toBe(0);

      await prisma.nudge.update({ where: { id: nudgeId }, data: { createdAt: new Date(Date.now() - 11_000) } });
      expect(await demo.acknowledgeBotNudges(new Date())).toBe(1);
      expect((await prisma.nudge.findUniqueOrThrow({ where: { id: nudgeId } })).acknowledgedAt).not.toBeNull();

      const summary = await request(http).get(`/houses/${houseId}/summary`).set(bearer(judge)).expect(200);
      expect(summary.body.myAcks.map((a: { nudgeId: string; recipientName: string }) => [a.nudgeId, a.recipientName])).toEqual([[nudgeId, 'Maya']]);
    });

    it('bot acks never touch nudges to judges', async () => {
      const id = await judgeId(0);
      await prisma.nudge.create({ data: { houseId, senderId: await botId(0), recipientId: id, messageIndex: 0, isDemo: true, createdAt: new Date(Date.now() - 10 * MIN) } });
      expect(await demo.acknowledgeBotNudges(new Date())).toBe(0);
    });
  });

  describe('demo locks', () => {
    it('a judge gets 403 on create, both joins, activate and dismiss, but can GET /me and add quiet times', async () => {
      const judge = await signIn('judge3@example.com');
      const id = await judgeId(2);
      const other = await request(http).post('/auth/signup').set('Fly-Client-IP', `10.7.2.${++ip}`).send({ name: 'Owner', email: 'owner@example.com', password: 'correct horse' });
      const otherAuth = { Authorization: `Bearer ${other.body.token}` };
      const made = await request(http).post('/houses').set(otherAuth).send({ name: 'Birch' }).expect(201);
      const otherHouse = made.body.house as { id: string };
      const invite = await request(http).get(`/houses/${otherHouse.id}/invite-link`).set(otherAuth).expect(200);
      const token = (invite.body.url as string).split('/').pop()!.split('?')[0]!;
      const membership = await prisma.membership.findFirstOrThrow({ where: { userId: id, houseId } });

      await request(http).post('/houses').set(bearer(judge)).send({ name: 'Mine' }).expect(403);
      await request(http).post(`/houses/${otherHouse.id}/join`).set(bearer(judge)).expect(403);
      await request(http).post(`/invites/${token}/join`).set(bearer(judge)).expect(403);
      await request(http).post(`/houses/${otherHouse.id}/activate`).set(bearer(judge)).expect(403);
      await request(http).delete(`/memberships/${membership.id}`).set(bearer(judge)).expect(403);
      expect(await prisma.membership.count({ where: { id: membership.id } })).toBe(1);
      expect(await prisma.house.count({ where: { ownerId: id } })).toBe(0);

      await request(http).get('/me').set(bearer(judge)).expect(200);
      await request(http).post(`/houses/${houseId}/quiet-times`).set(bearer(judge)).send({ days: [3], startMinute: 600, endMinute: 660 }).expect(201);
    });

    it('joining the demo house is 403 for a regular user', async () => {
      const res = await request(http).post('/auth/signup').set('Fly-Client-IP', `10.7.3.${++ip}`).send({ name: 'Visitor', email: 'visitor@example.com', password: 'correct horse' });
      const auth = { Authorization: `Bearer ${res.body.token}` };
      await request(http).post(`/houses/${houseId}/join`).set(auth).expect(403);
      const invite = await prisma.house.findUniqueOrThrow({ where: { id: houseId } });
      await request(http).post(`/invites/${invite.inviteToken}/join`).set(auth).expect(403);
      expect(await prisma.membership.count({ where: { houseId } })).toBe(8);
    });

    it('the demo summary has streakDays 10 and isDemo true', async () => {
      const judge = await signIn('judge1@example.com');
      const res = await request(http).get(`/houses/${houseId}/summary`).set(bearer(judge)).expect(200);
      expect(res.body.streakDays).toBe(10);
      expect(res.body.isDemo).toBe(true);
    });
  });

  describe('POST /demo/assign', () => {
    const judgeEmails = DEMO_JUDGES.map((j) => j.email);
    const assign = (body: Record<string, unknown> = {}) =>
      request(http).post('/demo/assign').set('Fly-Client-IP', `10.8.0.${++ip}`).send(body);
    const stamped = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).demoAssignedAt;

    beforeEach(async () => {
      await prisma.user.updateMany({ data: { demoAssignedAt: null } });
    });

    it('hands out five distinct judges, then the one stamped earliest, with the configured password', async () => {
      const emails: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await assign().expect(200);
        expect(res.body).toEqual({ email: expect.any(String), password: PASSWORD });
        emails.push(res.body.email as string);
      }
      expect([...emails].sort()).toEqual([...judgeEmails].sort());

      const sixth = await assign().expect(200);
      expect(sixth.body.email).toBe(emails[0]);
      // And it's now the most recent, so the next one is the second.
      expect((await assign().expect(200)).body.email).toBe(emails[1]);
    });

    it('the account it hands out can sign in', async () => {
      const res = await assign().expect(200);
      await request(http).post('/auth/signin').set('Fly-Client-IP', `10.8.1.${++ip}`).send(res.body).expect(200);
    });

    it('a preferred judge is returned again and becomes the most recently assigned', async () => {
      const first = (await assign().expect(200)).body.email as string;
      const second = (await assign().expect(200)).body.email as string;
      const before = (await stamped(first))!;

      const again = await assign({ preferredEmail: first }).expect(200);
      expect(again.body).toEqual({ email: first, password: PASSWORD });
      expect((await stamped(first))!.getTime()).toBeGreaterThan(before.getTime());

      // second is now the oldest stamped of the two, but three judges are unstamped and go first.
      const rest: string[] = [];
      for (let i = 0; i < 3; i++) rest.push((await assign().expect(200)).body.email as string);
      expect(new Set([first, second, ...rest]).size).toBe(5);
      expect((await assign().expect(200)).body.email).toBe(second);
    });

    it('normalises the preferred email (trim, lower case)', async () => {
      const res = await assign({ preferredEmail: '  JUDGE4@Example.com ' }).expect(200);
      expect(res.body.email).toBe('judge4@example.com');
      expect(await stamped('judge4@example.com')).not.toBeNull();
    });

    it('ignores a bot or a non-demo user as preferredEmail and falls back to the least recently used judge', async () => {
      await prisma.user.create({ data: { name: 'Plain', email: 'plain@example.com', passwordHash: 'x' } });
      for (const preferredEmail of ['maya.bot@example.com', 'plain@example.com', 'nobody@example.com']) {
        const res = await assign({ preferredEmail }).expect(200);
        expect(judgeEmails).toContain(res.body.email);
      }
      expect(await stamped('maya.bot@example.com')).toBeNull();
      expect(await stamped('plain@example.com')).toBeNull();
    });

    it('never returns an extra demo account that is not one of the canonical judges', async () => {
      const extra = 'extra-demo@example.com';
      await prisma.user.create({ data: { name: 'Extra', email: extra, isDemo: true, passwordHash: 'x' } });
      try {
        // As a preferred email: ignored.
        const res = await assign({ preferredEmail: extra }).expect(200);
        expect(judgeEmails).toContain(res.body.email);
        expect(await stamped(extra)).toBeNull();
        // Through least recently used: it is unstamped, so it would go first if it were eligible.
        for (let i = 0; i < 8; i++) expect(judgeEmails).toContain((await assign().expect(200)).body.email);
        expect(await stamped(extra)).toBeNull();
      } finally {
        await prisma.user.delete({ where: { email: extra } });
      }
    });

    it('never returns a bot, or a demo account without a password', async () => {
      await prisma.user.updateMany({ where: { email: { in: judgeEmails.slice(1) } }, data: { passwordHash: null } });
      for (let i = 0; i < 3; i++) expect((await assign().expect(200)).body.email).toBe('judge1@example.com');
      await prisma.user.update({ where: { email: 'judge1@example.com' }, data: { passwordHash: null } });
      const res = await assign().expect(503);
      expect(res.body.message).toBe("The demo isn't available right now");
      // Put the passwords back for the rest of the file.
      await upsertDemoWorld(prisma, { password: PASSWORD });
    });

    it('is 503 when no demo password is configured', async () => {
      const config = await import('../src/config.js');
      const spy = vi.spyOn(config, 'getConfig').mockReturnValue({ ...config.getConfig(), demoAccountPassword: undefined });
      try {
        await assign().expect(503);
      } finally {
        spy.mockRestore();
      }
    });

    it('rejects a malformed preferredEmail and unknown fields', async () => {
      await assign({ preferredEmail: 'not-an-email' }).expect(400);
      await assign({ preferredEmail: `${'a'.repeat(250)}@example.com` }).expect(400);
      await assign({ extra: 1 }).expect(400);
    });

    it('is public (no token) and throttled to 5 a minute per IP', async () => {
      const sameIp = () => request(http).post('/demo/assign').set('Fly-Client-IP', '10.8.9.9').send({});
      for (let i = 0; i < 5; i++) await sameIp().expect(200);
      await sameIp().expect(429);
    });

    it('concurrent requests never get the same account', async () => {
      const results = await Promise.all(judgeEmails.map(() => assign()));
      const statuses = results.map((r) => r.status);
      const emails = results.filter((r) => r.status === 200).map((r) => r.body.email as string);
      expect(new Set(emails).size).toBe(emails.length);
      expect(statuses.every((c) => c === 200 || c === 503)).toBe(true);
    });

    it('the nightly reset leaves demoAssignedAt alone', async () => {
      const email = (await assign().expect(200)).body.email as string;
      const before = await stamped(email);
      await prisma.systemState.deleteMany({ where: { key: LAST_DEMO_RESET_KEY } });
      expect(await resetDemoContent(prisma)).toBe(true);
      expect(await stamped(email)).toEqual(before);
    });
  });
});
