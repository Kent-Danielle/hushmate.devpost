import { describe, expect, it } from 'vitest';
import {
  describeRow,
  findOverlaps,
  groupSets,
  isRestingNow,
  nextStartToday,
  overlapMessage,
  restingSegment,
  restingUntil,
  segmentsForDay,
  type QuietTimeLike,
} from '../../src/lib/quietTime';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const row = (dayOfWeek: number, startMinute: number, endMinute: number): QuietTimeLike => ({ dayOfWeek, startMinute, endMinute });

// 2026-10-04 is a Sunday. date(0) = Sun, date(1) = Mon ... date(6) = Sat, date(7) = next Sun.
const date = (offset: number, hour = 12, minute = 0) => new Date(2026, 9, 4 + offset, hour, minute);
const SUN = 0;
const MON = 1;
const FRI = 5;
const SAT = 6;

describe('segmentsForDay', () => {
  it('draws a same-day quiet time as one block on its day', () => {
    const r = row(MON, h(13), h(15));
    const [seg, ...rest] = segmentsForDay([r], date(1));
    expect(rest).toEqual([]);
    expect(seg).toMatchObject({ startMinute: h(13), endMinute: h(15), part: 'start', continuesNext: false, continuesPrev: false });
    expect(segmentsForDay([r], date(2))).toEqual([]);
  });

  it('splits an overnight quiet time across midnight: start to 24:00, then 00:00 to the end next day', () => {
    const r = row(MON, h(23), h(7));
    const mon = segmentsForDay([r], date(1));
    expect(mon).toHaveLength(1);
    expect(mon[0]).toMatchObject({ startMinute: h(23), endMinute: 1440, part: 'start', continuesNext: true, continuesPrev: false });
    const tue = segmentsForDay([r], date(2));
    expect(tue).toHaveLength(1);
    expect(tue[0]).toMatchObject({ startMinute: 0, endMinute: h(7), part: 'tail', continuesNext: false, continuesPrev: true });
    expect(segmentsForDay([r], date(3))).toEqual([]);
  });

  it('wraps a Saturday-night quiet time onto Sunday morning', () => {
    const r = row(SAT, h(22), h(6));
    expect(segmentsForDay([r], date(6))[0]).toMatchObject({ part: 'start', startMinute: h(22), endMinute: 1440 });
    const sun = segmentsForDay([r], date(0));
    expect(sun).toHaveLength(1);
    expect(sun[0]).toMatchObject({ part: 'tail', startMinute: 0, endMinute: h(6), continuesPrev: true });
  });

  it('treats end == start as overnight (a full 24 hours)', () => {
    const r = row(MON, h(9), h(9));
    expect(segmentsForDay([r], date(1))[0]).toMatchObject({ startMinute: h(9), endMinute: 1440, continuesNext: true });
    expect(segmentsForDay([r], date(2))[0]).toMatchObject({ startMinute: 0, endMinute: h(9), part: 'tail' });
  });

  it("orders a day's segments by start, a morning tail before an evening start", () => {
    const evening = row(MON, h(20), h(22));
    const overnightFromSun = row(SUN, h(23), h(7));
    const out = segmentsForDay([evening, overnightFromSun], date(1));
    expect(out.map((s) => s.part)).toEqual(['tail', 'start']);
  });
});

describe('resting now', () => {
  const overnight = row(MON, h(23), h(7));

  it('is resting inside a same-day quiet time, with the start inclusive and the end exclusive', () => {
    const rows = [row(MON, h(13), h(15))];
    expect(isRestingNow(rows, date(1, 13, 0))).toBe(true);
    expect(isRestingNow(rows, date(1, 14, 59))).toBe(true);
    expect(isRestingNow(rows, date(1, 15, 0))).toBe(false);
    expect(isRestingNow(rows, date(1, 12, 59))).toBe(false);
  });

  it('is resting on the starting night after the start time', () => {
    expect(isRestingNow([overnight], date(1, 23, 30))).toBe(true);
    expect(isRestingNow([overnight], date(1, 22, 59))).toBe(false);
  });

  it('is resting on the overnight tail the next morning, and stops at the end minute', () => {
    expect(isRestingNow([overnight], date(2, 0, 0))).toBe(true);
    expect(isRestingNow([overnight], date(2, 6, 59))).toBe(true);
    expect(isRestingNow([overnight], date(2, 7, 0))).toBe(false);
  });

  it('is not resting on the morning of the start day (the tail belongs to the next day)', () => {
    expect(isRestingNow([overnight], date(1, 3, 0))).toBe(false);
  });

  it('rests on Sunday morning from a Saturday-night quiet time', () => {
    expect(isRestingNow([row(SAT, h(22), h(6))], date(7, 5, 0))).toBe(true);
  });

  it('returns the covering segment, or null with no rows', () => {
    expect(restingSegment([overnight], date(2, 1, 0))?.part).toBe('tail');
    expect(restingSegment([], date(1))).toBeNull();
  });

  it('restingUntil is the end as a minute of the day, even for the tail', () => {
    expect(restingUntil([overnight], date(2, 1, 0))).toBe(h(7));
    expect(restingUntil([overnight], date(1, 23, 30))).toBe(h(7));
    expect(restingUntil([overnight], date(3, 1, 0))).toBeNull();
  });
});

describe('nextStartToday', () => {
  it('finds the soonest later start today and ignores earlier, other-day and current ones', () => {
    const rows = [row(MON, h(8), h(9)), row(MON, h(20), h(21)), row(MON, h(18), h(19)), row(2, h(15), h(16))];
    expect(nextStartToday(rows, date(1, 12, 0))).toBe(h(18));
    expect(nextStartToday(rows, date(1, 18, 0))).toBe(h(20));
    expect(nextStartToday(rows, date(1, 21, 0))).toBeNull();
  });
});

describe('findOverlaps', () => {
  it('finds a clash on the same day', () => {
    const existing = row(MON, h(13), h(15));
    expect(findOverlaps({ days: [MON], startMinute: h(14), endMinute: h(16) }, [existing])).toEqual([existing]);
  });

  it('does not clash when the ends only touch', () => {
    const existing = row(MON, h(13), h(15));
    expect(findOverlaps({ days: [MON], startMinute: h(15), endMinute: h(17) }, [existing])).toEqual([]);
    expect(findOverlaps({ days: [MON], startMinute: h(11), endMinute: h(13) }, [existing])).toEqual([]);
  });

  it('does not clash on different days', () => {
    expect(findOverlaps({ days: [2], startMinute: h(13), endMinute: h(15) }, [row(MON, h(13), h(15))])).toEqual([]);
  });

  it('an overnight candidate clashes with the next morning of the following day', () => {
    const existing = row(2, h(6), h(8));
    expect(findOverlaps({ days: [MON], startMinute: h(23), endMinute: h(7) }, [existing])).toEqual([existing]);
  });

  it('an overnight candidate touching the next day start does not clash', () => {
    expect(findOverlaps({ days: [MON], startMinute: h(23), endMinute: h(7) }, [row(2, h(7), h(9))])).toEqual([]);
  });

  it('wraps Sunday night into Monday morning (end of the week meets the start)', () => {
    const monMorning = row(MON, h(5), h(8));
    expect(findOverlaps({ days: [SUN], startMinute: h(23), endMinute: h(6) }, [monMorning])).toEqual([monMorning]);
    // and the other way round: a Monday-morning candidate against a Sunday-night row
    const sunNight = row(SUN, h(23), h(6));
    expect(findOverlaps({ days: [MON], startMinute: h(5), endMinute: h(8) }, [sunNight])).toEqual([sunNight]);
  });

  it('Sunday night touching Monday start at the wrap does not clash', () => {
    expect(findOverlaps({ days: [SUN], startMinute: h(23), endMinute: h(6) }, [row(MON, h(6), h(8))])).toEqual([]);
  });

  it('wraps Saturday night onto Sunday morning', () => {
    const sunMorning = row(SUN, h(1), h(3));
    expect(findOverlaps({ days: [SAT], startMinute: h(22), endMinute: h(2) }, [sunMorning])).toEqual([sunMorning]);
  });

  it('checks every day of a multi-day candidate and returns only the clashing rows', () => {
    const wed = row(3, h(23), h(7));
    const thu = row(4, h(12), h(13));
    const out = findOverlaps({ days: [MON, 2, FRI], startMinute: h(22), endMinute: h(6) }, [wed, thu]);
    expect(out).toEqual([]);
    const clash = row(FRI, h(21), h(23));
    expect(findOverlaps({ days: [MON, 2, FRI], startMinute: h(22), endMinute: h(6) }, [wed, thu, clash])).toEqual([clash]);
  });

  it('two all-day (end == start) rows on adjacent days clash', () => {
    const a = row(MON, h(9), h(9));
    expect(findOverlaps({ days: [2], startMinute: h(8), endMinute: h(10) }, [a])).toEqual([a]);
  });
});

describe('messages', () => {
  it('describes a row and builds the overlap message from the first conflict', () => {
    const r = row(MON, h(23), h(7));
    expect(describeRow(r)).toBe('Mon 11:00 PM → 7:00 AM (next day)');
    expect(overlapMessage([r])).toBe('This overlaps your quiet time on Mon 11:00 PM → 7:00 AM (next day).');
    expect(overlapMessage([])).toBe('This overlaps another quiet time of yours.');
  });
});

describe('groupSets', () => {
  it('groups rows by setId with days ordered Monday first, and sorts sets by start then first day', () => {
    const rows = [
      { id: '1', setId: 'a', dayOfWeek: SUN, startMinute: h(23), endMinute: h(7) },
      { id: '2', setId: 'a', dayOfWeek: MON, startMinute: h(23), endMinute: h(7) },
      { id: '3', setId: 'b', dayOfWeek: 3, startMinute: h(13), endMinute: h(15) },
    ];
    const sets = groupSets(rows);
    expect(sets.map((s) => s.setId)).toEqual(['b', 'a']);
    expect(sets[1].days).toEqual([MON, SUN]);
    expect(sets[1].rows).toHaveLength(2);
    expect(sets[1]).toMatchObject({ startMinute: h(23), endMinute: h(7) });
  });
});
