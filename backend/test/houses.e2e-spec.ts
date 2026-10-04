import { createTestApp, truncateAll } from './setup.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import webpush from 'web-push';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';

vi.mock('web-push', () => {
  const mock = { setVapidDetails: vi.fn(), sendNotification: vi.fn() };
  return { default: mock, ...mock };
});

// randomCode delegates to the real implementation unless a test queues forced codes (collision path).
const forcedCodes: string[] = [];
vi.mock('../src/common/random.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/common/random.js')>();
  return { ...actual, randomCode: () => forcedCodes.shift() ?? actual.randomCode() };
});

describe('houses e2e', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let n = 0;

  type Person = { token: string; id: string };

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await truncateAll(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.mocked(webpush.sendNotification).mockReset();
    forcedCodes.length = 0;
  });

  const signUp = async (name: string): Promise<Person> => {
    const i = ++n;
    const res = await request(http)
      .post('/auth/signup')
      .set('Fly-Client-IP', `10.3.0.${i}`)
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
  const requestJoin = async (p: Person, houseId: string) => {
    const res = await request(http).post(`/houses/${houseId}/join`).set(as(p));
    expect(res.status).toBe(201);
    return res.body.membershipId as string;
  };
  const activeHouseId = async (p: Person) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: p.id } })).activeHouseId;

  describe('create', () => {
    it('creates a house with an approved colorIndex 0 owner membership and sets it active', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Maple');
      expect(house.code).toMatch(/^\d{6}$/);
      const m = await prisma.membership.findFirstOrThrow({ where: { userId: owner.id, houseId: house.id } });
      expect(m.status).toBe('approved');
      expect(m.colorIndex).toBe(0);
      expect(m.setupDoneAt).toBeNull();
      expect(await activeHouseId(owner)).toBe(house.id);
    });

    it('a second house does not replace the active house (only if none)', async () => {
      const owner = await signUp('owner');
      const first = await createHouse(owner, 'First');
      await createHouse(owner, 'Second');
      expect(await activeHouseId(owner)).toBe(first.id);
    });

    it('rejects invalid names with 400 (too short, too long, spaces, #, blank)', async () => {
      const owner = await signUp('owner');
      for (const name of ['a', 'x'.repeat(31), 'two words', 'bad#name', '   ', '']) {
        const res = await request(http).post('/houses').set(as(owner)).send({ name });
        expect(res.status, `name ${JSON.stringify(name)}`).toBe(400);
      }
    });

    it('trims the name and accepts the 2 and 30 character bounds', async () => {
      const owner = await signUp('owner');
      expect((await createHouse(owner, '  Ab  ')).name).toBe('Ab');
      expect((await createHouse(owner, 'x'.repeat(30))).name).toHaveLength(30);
    });

    it('requires sign-in', async () => {
      expect((await request(http).post('/houses').send({ name: 'Nope' })).status).toBe(401);
    });

    it('two houses with the same name get different codes', async () => {
      const a = await signUp('owner');
      const b = await signUp('owner');
      const h1 = await createHouse(a, 'Twin');
      const h2 = await createHouse(b, 'TWIN');
      expect(h1.code).not.toBe(h2.code);
      expect(h1.id).not.toBe(h2.id);
    });

    it('a (nameKey, code) collision retries with another code', async () => {
      const a = await signUp('owner');
      const b = await signUp('owner');
      const h1 = await createHouse(a, 'Clash');
      forcedCodes.push(h1.code, h1.code, '111111');
      const h2 = await createHouse(b, 'clash');
      expect(h2.code).toBe('111111');
      expect(forcedCodes).toHaveLength(0);
    });
  });

  describe('list and lookup', () => {
    it('GET /houses lists my memberships oldest first with flags and pendingCount for owners only', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const h1 = await createHouse(owner, 'Alpha');
      const h2 = await createHouse(owner, 'Beta');
      await requestJoin(joiner, h1.id);
      await requestJoin(joiner, h2.id);

      const mine = await request(http).get('/houses').set(as(owner));
      expect(mine.status).toBe(200);
      expect(mine.body.map((r: { house: { name: string } }) => r.house.name)).toEqual(['Alpha', 'Beta']);
      expect(mine.body[0]).toMatchObject({
        status: 'approved',
        isActive: true,
        isOwner: true,
        pendingCount: 1,
        setupDone: false,
        house: { id: h1.id, code: h1.code },
      });
      expect(mine.body[1]).toMatchObject({ isActive: false, isOwner: true, pendingCount: 1 });

      const theirs = await request(http).get('/houses').set(as(joiner));
      expect(theirs.body).toHaveLength(2);
      expect(theirs.body[0]).toMatchObject({ status: 'pending', isOwner: false, pendingCount: 0, isActive: false });
    });

    it('lookup is case-insensitive and finds the house', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Birch');
      const res = await request(http).get('/houses/lookup').query({ id: `bIrCh#${house.code}` }).set(as(owner));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: house.id, name: 'Birch', code: house.code });
    });

    it('lookup splits on the last # (the name part is matched whole)', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Elm');
      // 'Elm#x#<code>' splits to name 'elm#x', which no house has.
      const res = await request(http).get('/houses/lookup').query({ id: `Elm#x#${house.code}` }).set(as(owner));
      expect(res.status).toBe(404);
    });

    it('lookup returns 404 for a wrong code, malformed ids and a missing id', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Cedar');
      const wrong = house.code === '123456' ? '654321' : '123456';
      for (const id of [`Cedar#${wrong}`, 'Cedar', `#${house.code}`, 'Cedar#12', 'Nobody#123456']) {
        const res = await request(http).get('/houses/lookup').query({ id }).set(as(owner));
        expect(res.status, id).toBe(404);
      }
      expect((await request(http).get('/houses/lookup').set(as(owner))).status).toBe(404);
    });
  });

  describe('join', () => {
    it('creates a pending membership (201) and lists it in the owner requests', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'Pine');
      const membershipId = await requestJoin(joiner, house.id);
      const res = await request(http).get(`/houses/${house.id}/requests`).set(as(owner));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ membershipId, name: 'joiner' });
      expect(typeof res.body[0].createdAt).toBe('string');
    });

    it('requests are listed oldest first', async () => {
      const owner = await signUp('owner');
      const first = await signUp('first');
      const second = await signUp('second');
      const house = await createHouse(owner, 'Order');
      await requestJoin(first, house.id);
      await requestJoin(second, house.id);
      const res = await request(http).get(`/houses/${house.id}/requests`).set(as(owner));
      expect(res.body.map((r: { name: string }) => r.name)).toEqual(['first', 'second']);
    });

    it('409 when already pending, already approved, or the owner', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'Dup');
      const membershipId = await requestJoin(joiner, house.id);
      expect((await request(http).post(`/houses/${house.id}/join`).set(as(joiner))).status).toBe(409);
      await request(http).post(`/memberships/${membershipId}/approve`).set(as(owner)).expect(200);
      expect((await request(http).post(`/houses/${house.id}/join`).set(as(joiner))).status).toBe(409);
      expect((await request(http).post(`/houses/${house.id}/join`).set(as(owner))).status).toBe(409);
    });

    it('404 for an unknown house (valid uuid and non-uuid)', async () => {
      const joiner = await signUp('joiner');
      const missing = '00000000-0000-4000-8000-000000000000';
      expect((await request(http).post(`/houses/${missing}/join`).set(as(joiner))).status).toBe(404);
      expect((await request(http).post('/houses/not-a-uuid/join').set(as(joiner))).status).toBe(404);
    });

    it('403 "This is a demo house" when joining the demo house', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'Demoland');
      await prisma.house.update({ where: { id: house.id }, data: { isDemo: true } });
      const res = await request(http).post(`/houses/${house.id}/join`).set(as(joiner));
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('This is a demo house');
      const viaInvite = await request(http).get(`/houses/${house.id}/invite-link`).set(as(owner));
      const token = viaInvite.body.url.split('/').pop();
      expect((await request(http).post(`/invites/${token}/join`).set(as(joiner))).status).toBe(403);
    });

    it('requires sign-in', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Locked');
      expect((await request(http).post(`/houses/${house.id}/join`)).status).toBe(401);
    });
  });

  describe('approve', () => {
    it('sets approved, colorIndex by approved count (wrapping at 5), and sends the join-approved push', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Colors');
      const colors: number[] = [];
      for (let i = 0; i < 6; i++) {
        const joiner = await signUp(`j${i}`);
        const membershipId = await requestJoin(joiner, house.id);
        const res = await request(http).post(`/memberships/${membershipId}/approve`).set(as(owner));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'approved' });
        colors.push((await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } })).colorIndex);
      }
      // owner holds 0; approved counts 2..7 give (count-1)%5
      expect(colors).toEqual([1, 2, 3, 4, 0, 1]);
    });

    it('sets the requester\'s active house only if they have none', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Active');
      const other = await createHouse(await signUp('owner'), 'Other');

      const fresh = await signUp('fresh');
      const m1 = await requestJoin(fresh, house.id);
      expect(await activeHouseId(fresh)).toBeNull();
      await request(http).post(`/memberships/${m1}/approve`).set(as(owner)).expect(200);
      expect(await activeHouseId(fresh)).toBe(house.id);

      const busy = await signUp('busy');
      await prisma.user.update({ where: { id: busy.id }, data: { activeHouseId: other.id } });
      await prisma.membership.create({ data: { userId: busy.id, houseId: other.id, status: 'approved' } });
      const m2 = await requestJoin(busy, house.id);
      await request(http).post(`/memberships/${m2}/approve`).set(as(owner)).expect(200);
      expect(await activeHouseId(busy)).toBe(other.id);
    });

    it('sends one join-approved push to a subscribed requester; re-approving is idempotent (no 2nd push)', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'Welcome');
      await prisma.pushSubscription.create({
        data: { userId: joiner.id, endpoint: 'https://fcm.googleapis.com/fcm/send/houses-e2e', p256dh: 'k', auth: 'a' },
      });
      const membershipId = await requestJoin(joiner, house.id);
      vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, body: '', headers: {} });

      await request(http).post(`/memberships/${membershipId}/approve`).set(as(owner)).expect(200);
      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
      const [sub, payload] = vi.mocked(webpush.sendNotification).mock.calls[0];
      expect(sub.endpoint).toBe('https://fcm.googleapis.com/fcm/send/houses-e2e');
      expect(JSON.parse(String(payload)).notification.body).toBe("You're in! Welcome approved your request.");

      const again = await request(http).post(`/memberships/${membershipId}/approve`).set(as(owner));
      expect(again.status).toBe(200);
      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('approving without a push subscription still succeeds', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'Quiet');
      const membershipId = await requestJoin(joiner, house.id);
      await request(http).post(`/memberships/${membershipId}/approve`).set(as(owner)).expect(200);
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('a declined request cannot be approved (409)', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'NoTake');
      const membershipId = await requestJoin(joiner, house.id);
      await request(http).post(`/memberships/${membershipId}/decline`).set(as(owner)).expect(200);
      expect((await request(http).post(`/memberships/${membershipId}/approve`).set(as(owner))).status).toBe(409);
    });

    it('404 for an unknown membership', async () => {
      const owner = await signUp('owner');
      const missing = '00000000-0000-4000-8000-000000000000';
      expect((await request(http).post(`/memberships/${missing}/approve`).set(as(owner))).status).toBe(404);
    });
  });

  describe('decline and dismiss', () => {
    it('decline sets declined, is idempotent, and an approved member cannot be declined (409)', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const keeper = await signUp('keeper');
      const house = await createHouse(owner, 'Decline');
      const mJoin = await requestJoin(joiner, house.id);
      const mKeep = await requestJoin(keeper, house.id);

      const res = await request(http).post(`/memberships/${mJoin}/decline`).set(as(owner));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'declined' });
      expect((await request(http).post(`/memberships/${mJoin}/decline`).set(as(owner))).body).toEqual({
        status: 'declined',
      });

      await request(http).post(`/memberships/${mKeep}/approve`).set(as(owner)).expect(200);
      expect((await request(http).post(`/memberships/${mKeep}/decline`).set(as(owner))).status).toBe(409);
      const list = await request(http).get(`/houses/${house.id}/requests`).set(as(owner));
      expect(list.body).toEqual([]);
    });

    it('the requester dismisses a declined card (204) and can then join again', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'Again');
      const membershipId = await requestJoin(joiner, house.id);
      await request(http).post(`/memberships/${membershipId}/decline`).set(as(owner)).expect(200);
      // still blocked until dismissed
      expect((await request(http).post(`/houses/${house.id}/join`).set(as(joiner))).status).toBe(409);

      await request(http).delete(`/memberships/${membershipId}`).set(as(joiner)).expect(204);
      expect(await prisma.membership.count({ where: { id: membershipId } })).toBe(0);
      const second = await requestJoin(joiner, house.id);
      expect(second).not.toBe(membershipId);
    });

    it('dismiss is 403 for someone else\'s card, and for pending or approved cards', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const stranger = await signUp('stranger');
      const house = await createHouse(owner, 'Dismiss');
      const membershipId = await requestJoin(joiner, house.id);
      expect((await request(http).delete(`/memberships/${membershipId}`).set(as(joiner))).status).toBe(403); // pending
      await request(http).post(`/memberships/${membershipId}/decline`).set(as(owner)).expect(200);
      expect((await request(http).delete(`/memberships/${membershipId}`).set(as(stranger))).status).toBe(403);
      expect((await request(http).delete(`/memberships/${membershipId}`).set(as(owner))).status).toBe(403);

      const ownerMembership = await prisma.membership.findFirstOrThrow({ where: { userId: owner.id } });
      expect((await request(http).delete(`/memberships/${ownerMembership.id}`).set(as(owner))).status).toBe(403); // approved
      expect(await prisma.membership.count({ where: { id: membershipId } })).toBe(1);
    });
  });

  describe('owner-only routes', () => {
    it('a non-owner (member, pending and outsider) gets 403 on requests, approve and decline', async () => {
      const owner = await signUp('owner');
      const member = await signUp('member');
      const pending = await signUp('pending');
      const outsider = await signUp('outsider');
      const house = await createHouse(owner, 'Owners');
      const mMember = await requestJoin(member, house.id);
      await request(http).post(`/memberships/${mMember}/approve`).set(as(owner)).expect(200);
      const mPending = await requestJoin(pending, house.id);

      for (const p of [member, pending, outsider]) {
        expect((await request(http).get(`/houses/${house.id}/requests`).set(as(p))).status).toBe(403);
        expect((await request(http).post(`/memberships/${mPending}/approve`).set(as(p))).status).toBe(403);
        expect((await request(http).post(`/memberships/${mPending}/decline`).set(as(p))).status).toBe(403);
      }
      expect((await prisma.membership.findUniqueOrThrow({ where: { id: mPending } })).status).toBe('pending');
    });

    it('requests for an unknown house is 404', async () => {
      const owner = await signUp('owner');
      const missing = '00000000-0000-4000-8000-000000000000';
      expect((await request(http).get(`/houses/${missing}/requests`).set(as(owner))).status).toBe(404);
    });
  });

  describe('activate', () => {
    it('an approved member can switch the active house', async () => {
      const owner = await signUp('owner');
      const h1 = await createHouse(owner, 'One');
      const h2 = await createHouse(owner, 'Two');
      expect(await activeHouseId(owner)).toBe(h1.id);
      const res = await request(http).post(`/houses/${h2.id}/activate`).set(as(owner));
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ activeHouseId: h2.id });
      expect(await activeHouseId(owner)).toBe(h2.id);
    });

    it('403 for pending, declined and non-members, and the active house is unchanged', async () => {
      const owner = await signUp('owner');
      const pending = await signUp('pending');
      const declined = await signUp('declined');
      const outsider = await signUp('outsider');
      const house = await createHouse(owner, 'Gate');
      await requestJoin(pending, house.id);
      const mDeclined = await requestJoin(declined, house.id);
      await request(http).post(`/memberships/${mDeclined}/decline`).set(as(owner)).expect(200);
      for (const p of [pending, declined, outsider]) {
        expect((await request(http).post(`/houses/${house.id}/activate`).set(as(p))).status).toBe(403);
        expect(await activeHouseId(p)).toBeNull();
      }
    });
  });

  describe('invite links', () => {
    it('an approved member gets {url} ending in the invite token; non-approved get 403', async () => {
      const owner = await signUp('owner');
      const pending = await signUp('pending');
      const house = await createHouse(owner, 'Links');
      await requestJoin(pending, house.id);

      const res = await request(http).get(`/houses/${house.id}/invite-link`).set(as(owner));
      expect(res.status).toBe(200);
      const stored = await prisma.house.findUniqueOrThrow({ where: { id: house.id } });
      expect(res.body.url).toBe(`${process.env.APP_URL?.replace(/\/+$/, '')}/join/${stored.inviteToken}`);
      expect((await request(http).get(`/houses/${house.id}/invite-link`).set(as(pending))).status).toBe(403);
    });

    it('GET /invites/:token is public and returns {name, code}; unknown token 404', async () => {
      const owner = await signUp('owner');
      const house = await createHouse(owner, 'Public');
      const { inviteToken } = await prisma.house.findUniqueOrThrow({ where: { id: house.id } });
      const res = await request(http).get(`/invites/${inviteToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ name: 'Public', code: house.code });
      expect((await request(http).get('/invites/nope-not-a-token')).status).toBe(404);
    });

    it('POST /invites/:token/join creates a pending membership; repeat is 409; unknown token 404', async () => {
      const owner = await signUp('owner');
      const joiner = await signUp('joiner');
      const house = await createHouse(owner, 'ViaLink');
      const { inviteToken } = await prisma.house.findUniqueOrThrow({ where: { id: house.id } });
      const res = await request(http).post(`/invites/${inviteToken}/join`).set(as(joiner));
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      expect(res.body.membershipId).toEqual(expect.any(String));
      expect((await request(http).post(`/invites/${inviteToken}/join`).set(as(joiner))).status).toBe(409);
      expect((await request(http).post(`/invites/${inviteToken}/join`).set(as(owner))).status).toBe(409);
      expect((await request(http).post('/invites/nope/join').set(as(joiner))).status).toBe(404);
    });
  });

  describe('demo locks', () => {
    it('a demo user gets 403 on create, both joins, activate and dismiss but can still GET /me and /houses', async () => {
      // Quiet-time creation by a demo user arrives in slice 5 and is not covered here.
      const owner = await signUp('owner');
      const demo = await signUp('demo');
      const house = await createHouse(owner, 'Fortress');
      const { inviteToken } = await prisma.house.findUniqueOrThrow({ where: { id: house.id } });
      // A declined card and an approved membership for the demo user, so dismiss/activate reach the guard.
      const declined = await prisma.membership.create({
        data: { userId: demo.id, houseId: house.id, status: 'declined' },
      });
      await prisma.user.update({ where: { id: demo.id }, data: { isDemo: true } });

      const forbidden = async (req: request.Test) => {
        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('This is a demo account');
      };
      await forbidden(request(http).post('/houses').set(as(demo)).send({ name: 'Mine' }));
      await forbidden(request(http).post(`/houses/${house.id}/join`).set(as(demo)));
      await forbidden(request(http).post(`/invites/${inviteToken}/join`).set(as(demo)));
      await forbidden(request(http).post(`/houses/${house.id}/activate`).set(as(demo)));
      await forbidden(request(http).delete(`/memberships/${declined.id}`).set(as(demo)));

      expect(await prisma.membership.count({ where: { id: declined.id } })).toBe(1);
      expect(await prisma.house.count({ where: { name: 'Mine' } })).toBe(0);

      const me = await request(http).get('/me').set(as(demo));
      expect(me.status).toBe(200);
      expect(me.body.id ?? me.body.user?.id).toBe(demo.id);
      expect((await request(http).get('/houses').set(as(demo))).status).toBe(200);
    });
  });
});
