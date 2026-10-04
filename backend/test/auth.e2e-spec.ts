import { createTestApp, TEST_JWT_SECRET, truncateAll } from './setup.js';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('auth e2e', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let userId: string;
  let ipCounter = 0;
  // Auth routes allow 5 a minute per client IP: give each call its own fake IP.
  const ip = () => `10.0.0.${++ipCounter}`;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    await truncateAll(app);
  });
  afterAll(async () => {
    await app.close();
  });

  const signUp = (body: object) => request(http).post('/auth/signup').set('Fly-Client-IP', ip()).send(body);
  const signIn = (body: object) => request(http).post('/auth/signin').set('Fly-Client-IP', ip()).send(body);

  it('sign-up returns {token, user} without passwordHash', async () => {
    const res = await signUp({ name: 'Ada', email: 'Ada@Example.com', password: 'correct horse' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ name: 'Ada', email: 'ada@example.com', isDemo: false, activeHouseId: null });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    userId = res.body.user.id;

    const me = await request(http).get('/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(userId);
    expect(me.body).toHaveProperty('nudgeCooldownUntil', null);
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('a duplicate email in a different case returns 409', async () => {
    const res = await signUp({ name: 'Ada Two', email: 'ADA@EXAMPLE.COM', password: 'correct horse' });
    expect(res.status).toBe(409);
  });

  it('a 7-character password returns 400', async () => {
    const res = await signUp({ name: 'Short', email: 'short@example.com', password: '1234567' });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('wrong password and unknown email give identical 401s', async () => {
    const wrongPw = await signIn({ email: 'ada@example.com', password: 'not the password' });
    const unknown = await signIn({ email: 'nobody@example.com', password: 'not the password' });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body).toEqual(unknown.body);
    expect(wrongPw.body.message).toBe('Wrong email or password');
  });

  it('sign-in with the right password returns {token, user}', async () => {
    const res = await signIn({ email: 'ADA@example.com', password: 'correct horse' });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(typeof res.body.token).toBe('string');
  });

  it("a bot can't sign in, with the same 401 as any other failure", async () => {
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    await app.get(PrismaService).user.create({
      data: { name: 'Botty', email: 'bot@example.com', isBot: true, passwordHash: null },
    });
    const bot = await signIn({ email: 'bot@example.com', password: 'anything at all' });
    const unknown = await signIn({ email: 'nobody@example.com', password: 'anything at all' });
    expect(bot.status).toBe(401);
    expect(bot.body).toEqual(unknown.body);
  });

  describe('token checks on GET /me', () => {
    const me = (token?: string) => {
      const req = request(http).get('/me');
      return token === undefined ? req : req.set('Authorization', `Bearer ${token}`);
    };

    it('no token returns 401', async () => {
      expect((await me()).status).toBe(401);
    });
    it('a garbage token returns 401', async () => {
      expect((await me('not.a.jwt')).status).toBe(401);
    });
    it('a token signed with the wrong secret returns 401', async () => {
      const token = app.get(JwtService).sign({ sub: userId }, { secret: 'x'.repeat(48) });
      expect((await me(token)).status).toBe(401);
    });
    it('an expired token returns 401', async () => {
      const token = app.get(JwtService).sign({ sub: userId }, { secret: TEST_JWT_SECRET, expiresIn: -1 });
      expect((await me(token)).status).toBe(401);
    });
    it('a valid token for a deleted user returns 401', async () => {
      const token = app.get(JwtService).sign({ sub: '00000000-0000-4000-8000-000000000000' });
      expect((await me(token)).status).toBe(401);
    });
  });

  it('the 6th sign-in within 60 s returns 429 with Retry-After', async () => {
    const fresh = await createTestApp(); // the throttler store is per app instance
    try {
      const agent = () =>
        request(fresh.getHttpServer()).post('/auth/signin').set('Fly-Client-IP', '203.0.113.9');
      for (let i = 0; i < 5; i++) {
        const res = await agent().send({ email: 'ada@example.com', password: 'wrong password' });
        expect(res.status).toBe(401);
      }
      const sixth = await agent().send({ email: 'ada@example.com', password: 'correct horse' });
      expect(sixth.status).toBe(429);
      expect(sixth.headers['retry-after']).toBeDefined();
    } finally {
      await fresh.close();
    }
  });
});
