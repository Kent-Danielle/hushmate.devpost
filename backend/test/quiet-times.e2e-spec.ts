import { createTestApp, truncateAll } from './setup.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const MON = 1;
const TUE = 2;
const SAT = 6;
const SUN = 0;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('quiet times e2e', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let n = 0;

  type Person = { token: string; id: string };
  type BoardRow = { id: string; userId: string; setId: string; dayOfWeek: number; startMinute: number; endMinute: number };

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await truncateAll(app);
  });
  afterAll(async () => {
    await app.close();
  });

  const signUp = async (name: string): Promise<Person> => {
    const i = ++n;
    const res = await request(http)
      .post('/auth/signup')
      .set('Fly-Client-IP', `10.5.0.${i}`)
      .send({ name, email: `${name}${i}@example.com`, password: 'correct horse' });
    expect(res.status).toBe(201);
    return { token: res.body.token, id: res.body.user.id };
  };
  const as = (p: Person) => ({ Authorization: `Bearer ${p.token}` });
  const createHouse = async (owner: Person, name: string) => {
    const res = await request(http).post('/houses').set(as(owner)).send({ name });
    expect(res.status).toBe(201);
    return res.body.house as { id: string; name: string; code: string };
  };
  /** Adds a second approved member through the real join/approve flow. */
  const addMember = async (owner: Person, member: Person, houseId: string) => {
    const join = await request(http).post(`/houses/${houseId}/join`).set(as(member));
    expect(join.status).toBe(201);
    const approve = await request(http).post(`/memberships/${join.body.membershipId}/approve`).set(as(owner));
    expect(approve.status).toBe(200);
    return join.body.membershipId as string;
  };
  const membershipId = async (p: Person, houseId: string) =>
    (await prisma.membership.findUniqueOrThrow({ where: { userId_houseId: { userId: p.id, houseId } } })).id;
  const add = (p: Person, houseId: string, days: number[], startMinute: number, endMinute: number) =>
    request(http).post(`/houses/${houseId}/quiet-times`).set(as(p)).send({ days, startMinute, endMinute });
  const addOk = async (p: Person, houseId: string, days: number[], startMinute: number, endMinute: number) => {
    const res = await add(p, houseId, days, startMinute, endMinute);
    expect(res.status).toBe(201);
    return res.body.setId as string;
  };
  const board = async (p: Person, houseId: string) => {
    const res = await request(http).get(`/houses/${houseId}/board`).set(as(p));
    expect(res.status).toBe(200);
    return res.body.quietTimes as BoardRow[];
  };
  const mine = async (p: Person, houseId: string) =>
    (await board(p, houseId)).filter((r) => r.userId === p.id).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const rowFor = (rows: BoardRow[], day: number) => rows.find((r) => r.dayOfWeek === day)!;
  /** A user with one house (active), ready to add quiet times. */
  const owner = async (name = 'owner') => {
    const p = await signUp(name);
    const house = await createHouse(p, `H${n}`);
    return { p, houseId: house.id };
  };

  describe('create', () => {
    it('creates one row per day sharing a new setId, visible on the board', async () => {
      const { p, houseId } = await owner();
      const res = await add(p, houseId, [MON, 3, 5], h(22), h(23));
      expect(res.status).toBe(201);
      expect(res.body.setId).toMatch(/^[0-9a-f-]{36}$/);
      const rows = await mine(p, houseId);
      expect(rows.map((r) => r.dayOfWeek)).toEqual([1, 3, 5]);
      expect(new Set(rows.map((r) => r.setId))).toEqual(new Set([res.body.setId]));
      expect(rows.every((r) => r.startMinute === h(22) && r.endMinute === h(23))).toBe(true);
    });

    it('accepts the bounds: Sunday (0), Saturday (6), minute 0 and 1425, and all seven days', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [0, 1, 2, 3, 4, 5, 6], 0, 1425);
      expect(await mine(p, houseId)).toHaveLength(7);
    });

    it('rejects invalid bodies with 400 and creates nothing', async () => {
      const { p, houseId } = await owner();
      const bad: Record<string, unknown>[] = [
        { days: [], startMinute: h(22), endMinute: h(23) },
        { days: [1, 1], startMinute: h(22), endMinute: h(23) },
        { days: [7], startMinute: h(22), endMinute: h(23) },
        { days: [-1], startMinute: h(22), endMinute: h(23) },
        { days: [1.5], startMinute: h(22), endMinute: h(23) },
        { days: ['1'], startMinute: h(22), endMinute: h(23) },
        { days: [1, 2, 3, 4, 5, 6, 0, 1], startMinute: h(22), endMinute: h(23) },
        { days: 1, startMinute: h(22), endMinute: h(23) },
        { days: [1], startMinute: 10, endMinute: h(23) },
        { days: [1], startMinute: h(22), endMinute: 1430 },
        { days: [1], startMinute: -15, endMinute: h(23) },
        { days: [1], startMinute: h(22), endMinute: 1440 },
        { days: [1], startMinute: 1.5, endMinute: h(23) },
        { days: [1], startMinute: h(22), endMinute: h(22) },
        { days: [1], startMinute: h(22) },
        { days: [1], endMinute: h(22) },
        { startMinute: h(22), endMinute: h(23) },
      ];
      for (const body of bad) {
        const res = await request(http).post(`/houses/${houseId}/quiet-times`).set(as(p)).send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
      expect(await mine(p, houseId)).toHaveLength(0);
    });

    it('requires sign-in', async () => {
      const { houseId } = await owner();
      const res = await request(http)
        .post(`/houses/${houseId}/quiet-times`)
        .send({ days: [1], startMinute: h(22), endMinute: h(23) });
      expect(res.status).toBe(401);
    });

    it('403 for a non-member', async () => {
      const { houseId } = await owner();
      const stranger = await signUp('stranger');
      expect((await add(stranger, houseId, [1], h(22), h(23))).status).toBe(403);
    });

    it('403 for a pending (not yet approved) member', async () => {
      const { houseId } = await owner();
      const pending = await signUp('pending');
      await request(http).post(`/houses/${houseId}/join`).set(as(pending)).expect(201);
      expect((await add(pending, houseId, [1], h(22), h(23))).status).toBe(403);
    });
  });

  describe('active house and the setup step', () => {
    it('allows a non-active house while its setup is not done, then 403 once setup is done', async () => {
      const p = await signUp('twohouse');
      const first = await createHouse(p, 'First');
      const second = await createHouse(p, 'Second'); // first stays active
      expect((await prisma.user.findUniqueOrThrow({ where: { id: p.id } })).activeHouseId).toBe(first.id);

      // setup step for the non-active house: allowed
      await addOk(p, second.id, [MON], h(22), h(23));

      await request(http).post(`/memberships/${await membershipId(p, second.id)}/setup-done`).set(as(p)).expect(204);
      expect((await add(p, second.id, [TUE], h(22), h(23))).status).toBe(403);

      // the active house is always allowed, even with setup not done
      await addOk(p, first.id, [TUE], h(22), h(23));
    });

    it('allows the house once it becomes active again after setup is done', async () => {
      const p = await signUp('switcher');
      const first = await createHouse(p, 'Swa');
      const second = await createHouse(p, 'Swb');
      await request(http).post(`/memberships/${await membershipId(p, second.id)}/setup-done`).set(as(p)).expect(204);
      expect((await add(p, second.id, [MON], h(22), h(23))).status).toBe(403);
      await request(http).post(`/houses/${second.id}/activate`).set(as(p)).expect(201);
      await addOk(p, second.id, [MON], h(22), h(23));
      expect(first.id).not.toBe(second.id);
    });

    it('PATCH and DELETE are active-house only (403 in a non-active house, even during its setup)', async () => {
      const p = await signUp('editor');
      const first = await createHouse(p, 'Eda');
      const second = await createHouse(p, 'Edb');
      await addOk(p, second.id, [MON], h(22), h(23));
      const row = (await mine(p, second.id))[0];

      const patch = await request(http)
        .patch(`/quiet-times/${row.id}`)
        .set(as(p))
        .send({ startMinute: h(21), endMinute: h(22), scope: 'day' });
      expect(patch.status).toBe(403);
      expect((await request(http).delete(`/quiet-times/${row.id}`).set(as(p))).status).toBe(403);
      expect(await mine(p, second.id)).toHaveLength(1);

      await request(http).post(`/houses/${second.id}/activate`).set(as(p)).expect(201);
      await request(http).delete(`/quiet-times/${row.id}`).set(as(p)).expect(204);
      expect(first.id).not.toBe(second.id);
    });
  });

  describe('setup-done', () => {
    it('204, flips setupDone on GET /houses, and is idempotent', async () => {
      const { p, houseId } = await owner();
      const mId = await membershipId(p, houseId);
      const setupDone = async () => {
        const res = await request(http).get('/houses').set(as(p));
        return res.body.find((m: { membershipId: string }) => m.membershipId === mId).setupDone as boolean;
      };
      expect(await setupDone()).toBe(false);
      await request(http).post(`/memberships/${mId}/setup-done`).set(as(p)).expect(204);
      expect(await setupDone()).toBe(true);
      const first = (await prisma.membership.findUniqueOrThrow({ where: { id: mId } })).setupDoneAt;
      expect(first).not.toBeNull();
      await request(http).post(`/memberships/${mId}/setup-done`).set(as(p)).expect(204);
      expect((await prisma.membership.findUniqueOrThrow({ where: { id: mId } })).setupDoneAt).toEqual(first);
    });

    it('403 for someone else\'s membership, 403 for a pending one, 404 for a missing one, 401 signed out', async () => {
      const { p, houseId } = await owner();
      const other = await signUp('other');
      const mId = await membershipId(p, houseId);
      expect((await request(http).post(`/memberships/${mId}/setup-done`).set(as(other))).status).toBe(403);

      await request(http).post(`/houses/${houseId}/join`).set(as(other)).expect(201);
      const pendingId = await membershipId(other, houseId);
      expect((await request(http).post(`/memberships/${pendingId}/setup-done`).set(as(other))).status).toBe(403);
      expect((await prisma.membership.findUniqueOrThrow({ where: { id: pendingId } })).setupDoneAt).toBeNull();

      expect((await request(http).post(`/memberships/${MISSING_ID}/setup-done`).set(as(p))).status).toBe(404);
      expect((await request(http).post(`/memberships/${mId}/setup-done`)).status).toBe(401);
      expect((await prisma.membership.findUniqueOrThrow({ where: { id: mId } })).setupDoneAt).toBeNull();
    });
  });

  describe('overlap -> 409 with conflicts', () => {
    it('same day and time range: 409 {statusCode, message: "overlap", conflicts} with no ids', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(22), h(23));
      const res = await add(p, houseId, [MON], h(22, 30), h(23, 30));
      expect(res.status).toBe(409);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.message).toBe('overlap');
      expect(res.body.conflicts).toEqual([{ dayOfWeek: MON, startMinute: h(22), endMinute: h(23) }]);
      expect(await mine(p, houseId)).toHaveLength(1);
    });

    it('overnight into the next morning: Mon 11 PM -> 7 AM clashes with Tue 6-8 AM, but Tue 7 AM touches fine', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(23), h(7));
      const clash = await add(p, houseId, [TUE], h(6), h(8));
      expect(clash.status).toBe(409);
      expect(clash.body.conflicts).toEqual([{ dayOfWeek: MON, startMinute: h(23), endMinute: h(7) }]);
      await addOk(p, houseId, [TUE], h(7), h(8));
    });

    it('overnight on the same night: Mon 10-11:30 PM clashes with Mon 11 PM -> 7 AM; Mon 9-11 PM does not', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(23), h(7));
      expect((await add(p, houseId, [MON], h(22), h(23, 30))).status).toBe(409);
      await addOk(p, houseId, [MON], h(21), h(23));
    });

    it('Sunday -> Monday wrap: Sun 11 PM -> 7 AM clashes with Mon 6-7:30 AM', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [SUN], h(23), h(7));
      const res = await add(p, houseId, [MON], h(6), h(7, 30));
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([{ dayOfWeek: SUN, startMinute: h(23), endMinute: h(7) }]);
    });

    it('Saturday -> Sunday wrap (the end of the circular week): Sat 11 PM -> 7 AM clashes with Sun 5-6 AM', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [SAT], h(23), h(7));
      const res = await add(p, houseId, [SUN], h(5), h(6));
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([{ dayOfWeek: SAT, startMinute: h(23), endMinute: h(7) }]);
      await addOk(p, houseId, [SUN], h(7), h(8));
    });

    it('wraps from a new Sat-night overnight onto an existing Sunday morning', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [SUN], h(6), h(8));
      const res = await add(p, houseId, [SAT], h(23), h(7));
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([{ dayOfWeek: SUN, startMinute: h(6), endMinute: h(8) }]);
    });

    it('touching ends and different days do not clash', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(9), h(10));
      await addOk(p, houseId, [MON], h(10), h(11));
      await addOk(p, houseId, [MON], h(8), h(9));
      await addOk(p, houseId, [TUE], h(9), h(10));
      expect(await mine(p, houseId)).toHaveLength(4);
    });

    it('lists every clashing existing row once, and creates none of the new rows', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [1, 3], h(22), h(23));
      await addOk(p, houseId, [2], h(22), h(23));
      const res = await add(p, houseId, [1, 3, 5], h(22, 30), h(23, 30));
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toHaveLength(2);
      expect(res.body.conflicts).toEqual(
        expect.arrayContaining([
          { dayOfWeek: 1, startMinute: h(22), endMinute: h(23) },
          { dayOfWeek: 3, startMinute: h(22), endMinute: h(23) },
        ]),
      );
      expect(await mine(p, houseId)).toHaveLength(3);
    });

    it('overlap is per house: the same time in another house is fine', async () => {
      const p = await signUp('housea');
      const first = await createHouse(p, 'Pha');
      const second = await createHouse(p, 'Phb');
      await addOk(p, first.id, [MON], h(22), h(23));
      await addOk(p, second.id, [MON], h(22), h(23)); // setup step of the non-active house
    });

    it('overlap is per user: two housemates may have overlapping times', async () => {
      const a = await signUp('alice');
      const b = await signUp('bea');
      const house = await createHouse(a, 'Duo');
      await addMember(a, b, house.id);
      await addOk(a, house.id, [MON], h(22), h(23));
      await addOk(b, house.id, [MON], h(22), h(23));
      await addOk(b, house.id, [TUE], h(1), h(2)); // sanity: b's own rows still saved
      const rows = await board(a, house.id);
      expect(rows.filter((r) => r.userId === a.id)).toHaveLength(1);
      expect(rows.filter((r) => r.userId === b.id)).toHaveLength(2);
    });
  });

  describe('PATCH scope day vs set', () => {
    const patch = (p: Person, id: string, body: Record<string, unknown>) =>
      request(http).patch(`/quiet-times/${id}`).set(as(p)).send(body);

    it('scope "set" updates every row of the setId and keeps the setId', async () => {
      const { p, houseId } = await owner();
      const setId = await addOk(p, houseId, [1, 3, 5], h(22), h(23));
      const before = await mine(p, houseId);
      const res = await patch(p, rowFor(before, 3).id, { startMinute: h(21), endMinute: h(22, 30), scope: 'set' });
      expect(res.status).toBe(200);
      const after = await mine(p, houseId);
      expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());
      expect(after.every((r) => r.setId === setId && r.startMinute === h(21) && r.endMinute === h(22, 30))).toBe(true);
    });

    it('scope "set" is not blocked by the set\'s own rows (shifting within its own old range)', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [1, 3], h(22), h(23));
      const rows = await mine(p, houseId);
      await patch(p, rowFor(rows, 1).id, { startMinute: h(22, 30), endMinute: h(23, 30), scope: 'set' }).expect(200);
    });

    it('scope "day" updates only that row and splits it into a new setId', async () => {
      const { p, houseId } = await owner();
      const setId = await addOk(p, houseId, [1, 3, 5], h(22), h(23));
      const before = await mine(p, houseId);
      const res = await patch(p, rowFor(before, 3).id, { startMinute: h(20), endMinute: h(21), scope: 'day' });
      expect(res.status).toBe(200);
      const after = await mine(p, houseId);
      expect(after).toHaveLength(3);
      const wed = rowFor(after, 3);
      expect(wed.id).toBe(rowFor(before, 3).id);
      expect([wed.startMinute, wed.endMinute]).toEqual([h(20), h(21)]);
      expect(wed.setId).not.toBe(setId);
      for (const day of [1, 5]) {
        const r = rowFor(after, day);
        expect([r.setId, r.startMinute, r.endMinute]).toEqual([setId, h(22), h(23)]);
      }
    });

    it('a later scope "set" edit on the split row touches only the split row', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [1, 3], h(22), h(23));
      const rows = await mine(p, houseId);
      await patch(p, rowFor(rows, 3).id, { startMinute: h(20), endMinute: h(21), scope: 'day' }).expect(200);
      await patch(p, rowFor(rows, 3).id, { startMinute: h(19), endMinute: h(20), scope: 'set' }).expect(200);
      const after = await mine(p, houseId);
      expect(rowFor(after, 3).startMinute).toBe(h(19));
      expect(rowFor(after, 1).startMinute).toBe(h(22));
    });

    it('409 with conflicts when a same-day edit clashes with another of my rows, and nothing changes', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(22), h(23));
      await addOk(p, houseId, [MON], h(8), h(9));
      const rows = (await mine(p, houseId)).sort((x, y) => x.startMinute - y.startMinute);
      const res = await patch(p, rows[0].id, { startMinute: h(22, 30), endMinute: h(23, 30), scope: 'day' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ statusCode: 409, message: 'overlap' });
      expect(res.body.conflicts).toEqual([{ dayOfWeek: MON, startMinute: h(22), endMinute: h(23) }]);
      expect((await mine(p, houseId)).sort((x, y) => x.startMinute - y.startMinute)).toEqual(rows);
    });

    it('409 for an edit that clashes (overnight into the next morning), rows unchanged', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(23), h(7));
      await addOk(p, houseId, [TUE], h(9), h(10));
      const rows = await mine(p, houseId);
      const res = await patch(p, rowFor(rows, TUE).id, { startMinute: h(6), endMinute: h(8), scope: 'day' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ statusCode: 409, message: 'overlap' });
      expect(res.body.conflicts).toEqual([{ dayOfWeek: MON, startMinute: h(23), endMinute: h(7) }]);
      expect(await mine(p, houseId)).toEqual(rows);
    });

    it('409 for a Sunday -> Monday wrap on edit, scope "set" checks every day of the set', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [SUN], h(23), h(7));
      const setId = await addOk(p, houseId, [MON, 4], h(12), h(13));
      const rows = await mine(p, houseId);
      const monRow = rowFor(rows, MON);
      expect(monRow.setId).toBe(setId);
      const res = await patch(p, monRow.id, { startMinute: h(6), endMinute: h(8), scope: 'set' });
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([{ dayOfWeek: SUN, startMinute: h(23), endMinute: h(7) }]);
      expect(await mine(p, houseId)).toEqual(rows);
    });

    it('rejects invalid bodies with 400', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(22), h(23));
      const id = (await mine(p, houseId))[0].id;
      const bad: Record<string, unknown>[] = [
        { startMinute: h(21), endMinute: h(22), scope: 'week' },
        { startMinute: h(21), endMinute: h(22) },
        { startMinute: 7, endMinute: h(22), scope: 'day' },
        { startMinute: h(21), endMinute: 1440, scope: 'day' },
        { startMinute: h(21), endMinute: h(21), scope: 'set' },
        { endMinute: h(21), scope: 'set' },
      ];
      for (const body of bad) {
        expect((await patch(p, id, body)).status, JSON.stringify(body)).toBe(400);
      }
      expect((await mine(p, houseId))[0]).toMatchObject({ startMinute: h(22), endMinute: h(23) });
    });

    it('404 for another user\'s row (even a housemate\'s) and for a missing one; 401 signed out', async () => {
      const a = await signUp('pa');
      const b = await signUp('pb');
      const house = await createHouse(a, 'Pat');
      await addMember(a, b, house.id);
      await addOk(a, house.id, [MON], h(22), h(23));
      const aRow = (await mine(a, house.id))[0];
      const body = { startMinute: h(20), endMinute: h(21), scope: 'set' };
      expect((await patch(b, aRow.id, body)).status).toBe(404);
      expect((await patch(a, MISSING_ID, body)).status).toBe(404);
      expect((await request(http).patch(`/quiet-times/${aRow.id}`).send(body)).status).toBe(401);
      expect((await mine(a, house.id))[0]).toMatchObject({ startMinute: h(22), endMinute: h(23) });
    });
  });

  describe('DELETE scope day vs set', () => {
    it('defaults to scope "day": removes only that row', async () => {
      const { p, houseId } = await owner();
      const setId = await addOk(p, houseId, [1, 3, 5], h(22), h(23));
      const before = await mine(p, houseId);
      await request(http).delete(`/quiet-times/${rowFor(before, 3).id}`).set(as(p)).expect(204);
      const after = await mine(p, houseId);
      expect(after.map((r) => r.dayOfWeek)).toEqual([1, 5]);
      expect(after.every((r) => r.setId === setId)).toBe(true);
    });

    it('?scope=day removes only that row', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [1, 3], h(22), h(23));
      const rows = await mine(p, houseId);
      await request(http).delete(`/quiet-times/${rowFor(rows, 1).id}?scope=day`).set(as(p)).expect(204);
      expect((await mine(p, houseId)).map((r) => r.dayOfWeek)).toEqual([3]);
    });

    it('?scope=set removes every row of the setId and leaves other sets alone', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [1, 3, 5], h(22), h(23));
      const otherSet = await addOk(p, houseId, [2], h(8), h(9));
      const rows = await mine(p, houseId);
      await request(http).delete(`/quiet-times/${rowFor(rows, 3).id}?scope=set`).set(as(p)).expect(204);
      const after = await mine(p, houseId);
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({ dayOfWeek: 2, setId: otherSet });
    });

    it('scope "set" after a day-split deletes only the split row', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [1, 3], h(22), h(23));
      const rows = await mine(p, houseId);
      await request(http)
        .patch(`/quiet-times/${rowFor(rows, 3).id}`)
        .set(as(p))
        .send({ startMinute: h(20), endMinute: h(21), scope: 'day' })
        .expect(200);
      await request(http).delete(`/quiet-times/${rowFor(rows, 3).id}?scope=set`).set(as(p)).expect(204);
      expect((await mine(p, houseId)).map((r) => r.dayOfWeek)).toEqual([1]);
    });

    it('an invalid scope is 400 and deletes nothing', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [1], h(22), h(23));
      const id = (await mine(p, houseId))[0].id;
      expect((await request(http).delete(`/quiet-times/${id}?scope=week`).set(as(p))).status).toBe(400);
      expect(await mine(p, houseId)).toHaveLength(1);
    });

    it('404 for another user\'s row and for a missing one; 401 signed out', async () => {
      const a = await signUp('da');
      const b = await signUp('db');
      const house = await createHouse(a, 'Del');
      await addMember(a, b, house.id);
      await addOk(a, house.id, [MON], h(22), h(23));
      const aRow = (await mine(a, house.id))[0];
      expect((await request(http).delete(`/quiet-times/${aRow.id}?scope=set`).set(as(b))).status).toBe(404);
      expect((await request(http).delete(`/quiet-times/${MISSING_ID}`).set(as(a))).status).toBe(404);
      expect((await request(http).delete(`/quiet-times/${aRow.id}`)).status).toBe(401);
      expect(await mine(a, house.id)).toHaveLength(1);
    });

    it('deleting frees the time: the same range can be added again', async () => {
      const { p, houseId } = await owner();
      await addOk(p, houseId, [MON], h(22), h(23));
      const id = (await mine(p, houseId))[0].id;
      await request(http).delete(`/quiet-times/${id}`).set(as(p)).expect(204);
      await addOk(p, houseId, [MON], h(22), h(23));
    });
  });

  describe('demo user', () => {
    it('a demo user can still add, edit and delete quiet times', async () => {
      const { p, houseId } = await owner('demo');
      await prisma.user.update({ where: { id: p.id }, data: { isDemo: true } });
      const setId = await addOk(p, houseId, [MON, TUE], h(22), h(23));
      expect(setId).toBeTruthy();
      const rows = await mine(p, houseId);
      expect(rows).toHaveLength(2);
      await request(http)
        .patch(`/quiet-times/${rows[0].id}`)
        .set(as(p))
        .send({ startMinute: h(21), endMinute: h(22), scope: 'set' })
        .expect(200);
      await request(http).delete(`/quiet-times/${rows[0].id}?scope=set`).set(as(p)).expect(204);
      expect(await mine(p, houseId)).toHaveLength(0);
    });
  });

  describe('board', () => {
    it('shows every approved member\'s quiet times side by side, without emails', async () => {
      const a = await signUp('ba');
      const b = await signUp('bb');
      const house = await createHouse(a, 'Side');
      await addMember(a, b, house.id);
      await addOk(a, house.id, [MON], h(22), h(23));
      await addOk(b, house.id, [MON], h(22), h(23));
      const res = await request(http).get(`/houses/${house.id}/board`).set(as(b));
      expect(res.status).toBe(200);
      expect(res.body.quietTimes).toHaveLength(2);
      expect(new Set(res.body.quietTimes.map((r: BoardRow) => r.userId))).toEqual(new Set([a.id, b.id]));
      expect(res.body.quietTimes[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), setId: expect.any(String), dayOfWeek: MON }),
      );
      expect(JSON.stringify(res.body)).not.toContain('@example.com');
    });
  });
});
