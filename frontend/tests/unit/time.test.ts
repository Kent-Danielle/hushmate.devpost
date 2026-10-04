import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayShort,
  formatDate,
  formatDays,
  formatHour,
  formatMinutes,
  formatRange,
  formatWeek,
  isOvernight,
  isSameDay,
  minuteOfDay,
  sortDays,
  startOfWeek,
  timeOptions,
  WEEK_ORDER,
} from '../../src/lib/time';

describe('formatMinutes', () => {
  it('formats on a 12-hour clock', () => {
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(15)).toBe('12:15 AM');
    expect(formatMinutes(420)).toBe('7:00 AM');
    expect(formatMinutes(720)).toBe('12:00 PM');
    expect(formatMinutes(1380)).toBe('11:00 PM');
    expect(formatMinutes(1425)).toBe('11:45 PM');
  });
  it('wraps 1440 back to midnight', () => {
    expect(formatMinutes(1440)).toBe('12:00 AM');
  });
});

describe('formatHour', () => {
  it('labels the grid hours', () => {
    expect(formatHour(0)).toBe('12 AM');
    expect(formatHour(1)).toBe('1 AM');
    expect(formatHour(12)).toBe('12 PM');
    expect(formatHour(13)).toBe('1 PM');
  });
});

describe('isOvernight and formatRange', () => {
  it('end <= start is overnight', () => {
    expect(isOvernight(1380, 420)).toBe(true);
    expect(isOvernight(540, 540)).toBe(true);
    expect(isOvernight(540, 600)).toBe(false);
  });
  it('appends (next day) only for overnight ranges, unless asked not to', () => {
    expect(formatRange(1380, 420)).toBe('11:00 PM → 7:00 AM (next day)');
    expect(formatRange(1380, 420, false)).toBe('11:00 PM → 7:00 AM');
    expect(formatRange(780, 900)).toBe('1:00 PM → 3:00 PM');
  });
});

describe('timeOptions', () => {
  it('is every 15 minutes from 0 to 1425', () => {
    const o = timeOptions();
    expect(o).toHaveLength(96);
    expect(o[0]).toBe(0);
    expect(o[1]).toBe(15);
    expect(o[95]).toBe(1425);
  });
});

describe('days', () => {
  it('shows Monday first with Sunday last', () => {
    expect(WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(sortDays([0, 5, 1, 1, 3])).toEqual([1, 3, 5, 0]);
    expect(formatDays([0, 5, 1])).toBe('Mon, Fri, Sun');
  });
  it('names days with 0 = Sunday', () => {
    expect(dayShort(0)).toBe('Sun');
    expect(dayShort(6)).toBe('Sat');
    expect(dayShort(7)).toBe('Sun');
  });
});

describe('dates', () => {
  // 2026-10-04 is a Sunday.
  it('startOfWeek returns the Monday on or before', () => {
    expect(startOfWeek(new Date(2026, 9, 4, 15, 30))).toEqual(new Date(2026, 8, 28));
    expect(startOfWeek(new Date(2026, 9, 5))).toEqual(new Date(2026, 9, 5));
    expect(startOfWeek(new Date(2026, 9, 7, 9))).toEqual(new Date(2026, 9, 5));
  });
  it('addDays crosses month ends and drops the time', () => {
    expect(addDays(new Date(2026, 9, 31, 22), 1)).toEqual(new Date(2026, 10, 1));
    expect(addDays(new Date(2026, 9, 1), -1)).toEqual(new Date(2026, 8, 30));
  });
  it('isSameDay compares calendar days', () => {
    expect(isSameDay(new Date(2026, 9, 4, 0, 1), new Date(2026, 9, 4, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 4), new Date(2026, 9, 5))).toBe(false);
  });
  it('minuteOfDay', () => {
    expect(minuteOfDay(new Date(2026, 9, 4, 21, 40))).toBe(1300);
    expect(minuteOfDay(new Date(2026, 9, 4, 0, 0))).toBe(0);
  });
  it('formatDate and formatWeek', () => {
    expect(formatDate(new Date(2026, 9, 8))).toBe('Thu, Oct 8');
    expect(formatWeek(new Date(2026, 9, 5))).toBe('Oct 5 – 11');
    expect(formatWeek(new Date(2026, 8, 28))).toBe('Sep 28 – Oct 4');
  });
});
