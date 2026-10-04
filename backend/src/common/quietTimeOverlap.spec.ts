import { describe, expect, it } from 'vitest';
import { findOverlaps } from './quietTimeOverlap.js';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const row = (dayOfWeek: number, startMinute: number, endMinute: number) => ({ dayOfWeek, startMinute, endMinute });

describe('findOverlaps', () => {
  it('finds nothing with no rows', () => {
    expect(findOverlaps({ days: [1], startMinute: h(22), endMinute: h(23) }, [])).toEqual([]);
  });

  it('flags the same day and time range', () => {
    const existing = row(1, h(22), h(23));
    expect(findOverlaps({ days: [1], startMinute: h(22, 30), endMinute: h(23, 30) }, [existing])).toEqual([existing]);
  });

  it('does not flag different days', () => {
    expect(findOverlaps({ days: [2], startMinute: h(22), endMinute: h(23) }, [row(1, h(22), h(23))])).toEqual([]);
  });

  it('treats touching ends as fine', () => {
    const existing = row(1, h(9), h(10));
    expect(findOverlaps({ days: [1], startMinute: h(10), endMinute: h(11) }, [existing])).toEqual([]);
    expect(findOverlaps({ days: [1], startMinute: h(8), endMinute: h(9) }, [existing])).toEqual([]);
  });

  it('flags an overnight row against the next morning', () => {
    const overnight = row(1, h(23), h(7)); // Mon 11 PM -> Tue 7 AM
    expect(findOverlaps({ days: [2], startMinute: h(6), endMinute: h(8) }, [overnight])).toEqual([overnight]);
    expect(findOverlaps({ days: [2], startMinute: h(7), endMinute: h(8) }, [overnight])).toEqual([]);
  });

  it('flags a late-evening row on the next night against an overnight one', () => {
    const overnight = row(1, h(23), h(7));
    expect(findOverlaps({ days: [1], startMinute: h(22), endMinute: h(23, 30) }, [overnight])).toEqual([overnight]);
    expect(findOverlaps({ days: [1], startMinute: h(21), endMinute: h(23) }, [overnight])).toEqual([]);
  });

  it('wraps Sunday night into Monday morning', () => {
    const sundayNight = row(0, h(23), h(7)); // Sun 11 PM -> Mon 7 AM
    const mondayMorning = { days: [1], startMinute: h(6), endMinute: h(7, 30) };
    expect(findOverlaps(mondayMorning, [sundayNight])).toEqual([sundayNight]);
  });

  it('wraps Saturday night into Sunday morning (end of the circular week)', () => {
    const saturdayNight = row(6, h(23), h(7)); // Sat 11 PM -> Sun 7 AM
    expect(findOverlaps({ days: [0], startMinute: h(5), endMinute: h(6) }, [saturdayNight])).toEqual([saturdayNight]);
    expect(findOverlaps({ days: [0], startMinute: h(7), endMinute: h(8) }, [saturdayNight])).toEqual([]);
  });

  it('wraps from a Saturday-night candidate onto an existing Sunday morning', () => {
    const sundayMorning = row(0, h(6), h(8));
    expect(findOverlaps({ days: [6], startMinute: h(23), endMinute: h(7) }, [sundayMorning])).toEqual([sundayMorning]);
  });

  it('checks every chosen day and reports each clashing row once', () => {
    const a = row(1, h(22), h(23));
    const b = row(3, h(22), h(23));
    const c = row(2, h(22), h(23));
    expect(findOverlaps({ days: [1, 3, 5], startMinute: h(22, 30), endMinute: h(23, 30) }, [a, b, c])).toEqual([a, b]);
  });

  it('treats end == start as a full-day-minus-nothing overnight range', () => {
    const existing = row(1, h(12), h(12)); // 24 hours
    expect(findOverlaps({ days: [2], startMinute: h(1), endMinute: h(2) }, [existing])).toEqual([existing]);
  });

  it('wraps from a Sunday-night candidate onto an existing Monday morning', () => {
    const mondayMorning = row(1, h(6), h(8));
    expect(findOverlaps({ days: [0], startMinute: h(23), endMinute: h(7) }, [mondayMorning])).toEqual([mondayMorning]);
    expect(findOverlaps({ days: [0], startMinute: h(23), endMinute: h(6) }, [mondayMorning])).toEqual([]);
  });

  it('does not flag rows a day apart when the earlier one ends before midnight', () => {
    expect(findOverlaps({ days: [0], startMinute: h(20), endMinute: h(23) }, [row(1, h(1), h(2))])).toEqual([]);
    expect(findOverlaps({ days: [6], startMinute: h(20), endMinute: h(23) }, [row(0, h(1), h(2))])).toEqual([]);
  });
});
