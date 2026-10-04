import { randomCode, randomInviteToken, randomMinutes } from './random.js';

describe('random', () => {
  it('makes 6-digit codes', () => {
    for (let i = 0; i < 200; i++) expect(randomCode()).toMatch(/^[1-9]\d{5}$/);
  });

  it('makes base64url invite tokens of 32 bytes that differ', () => {
    const a = randomInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomInviteToken()).not.toBe(a);
  });

  it('keeps minutes inside the inclusive range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const m = randomMinutes(1, 10);
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(10);
      seen.add(m);
    }
    expect(seen.has(1) && seen.has(10)).toBe(true);
  });
});
