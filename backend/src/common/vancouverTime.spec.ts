import { describe, expect, it } from 'vitest';
import { latestVancouver3am, vancouverDaysBetween, vancouverParts } from './vancouverTime.js';

// Offsets come from the runtime's tz database (BC's DST rules may change), so the DST weeks are
// checked by property: the result is exactly 03:00 Vancouver time, not after `now`, less than 25 h before it.
function check(iso: string, expectedDay?: string) {
  const now = new Date(iso);
  const result = latestVancouver3am(now);
  const p = vancouverParts(result);
  expect([p.hour, p.minute, p.second]).toEqual([3, 0, 0]);
  expect(result.getTime()).toBeLessThanOrEqual(now.getTime());
  expect(now.getTime() - result.getTime()).toBeLessThan(25 * 3600_000);
  if (expectedDay) expect(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`).toBe(expectedDay);
  return result;
}

describe('latestVancouver3am', () => {
  it('summer: today 03:00 PDT (UTC-7) after 3 AM', () => {
    expect(check('2026-07-15T19:00:00Z', '2026-07-15').toISOString()).toBe('2026-07-15T10:00:00.000Z');
  });
  it('summer: yesterday 03:00 before 3 AM', () => {
    expect(check('2026-07-15T08:00:00Z', '2026-07-14').toISOString()).toBe('2026-07-14T10:00:00.000Z');
  });
  it('is exactly the boundary at 03:00', () => {
    expect(latestVancouver3am(new Date('2026-07-15T10:00:00Z')).toISOString()).toBe('2026-07-15T10:00:00.000Z');
    expect(latestVancouver3am(new Date('2026-07-15T09:59:59Z')).toISOString()).toBe('2026-07-14T10:00:00.000Z');
  });
  it('winter and both DST weeks always land on a Vancouver 03:00', () => {
    check('2026-12-10T20:00:00Z', '2026-12-10');
    for (const iso of ['2026-03-07T20:00:00Z', '2026-03-08T09:00:00Z', '2026-03-08T15:00:00Z', '2026-03-09T09:00:00Z']) check(iso);
    for (const iso of ['2026-10-31T20:00:00Z', '2026-11-01T09:00:00Z', '2026-11-01T20:00:00Z', '2026-11-02T09:00:00Z']) check(iso);
  });
});

describe('vancouverDaysBetween', () => {
  it('counts calendar days in Vancouver, not 24-hour blocks', () => {
    // 11 PM and 1 AM next day Vancouver: 2 hours apart, 1 calendar day
    expect(vancouverDaysBetween(new Date('2026-07-15T06:00:00Z'), new Date('2026-07-15T08:00:00Z'))).toBe(1);
    expect(vancouverDaysBetween(new Date('2026-07-15T19:00:00Z'), new Date('2026-07-15T21:00:00Z'))).toBe(0);
  });
  it('is correct across the spring-forward week', () => {
    expect(vancouverDaysBetween(new Date('2026-03-07T20:00:00Z'), new Date('2026-03-09T20:00:00Z'))).toBe(2);
  });
  it('is correct across the fall-back week', () => {
    expect(vancouverDaysBetween(new Date('2026-10-31T20:00:00Z'), new Date('2026-11-02T20:00:00Z'))).toBe(2);
  });
  it('never goes negative', () => {
    expect(vancouverDaysBetween(new Date('2026-07-16T00:00:00Z'), new Date('2026-07-15T00:00:00Z'))).toBe(0);
  });
});
