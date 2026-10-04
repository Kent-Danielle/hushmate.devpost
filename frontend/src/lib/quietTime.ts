import { MINUTES_PER_DAY, dayShort, formatMinutes, formatRange, sortDays } from './time';

// Quiet-time maths (spec: Frontend: Shared lib). dayOfWeek is the night a quiet time STARTS: 0 = Sunday ... 6 = Saturday.
// endMinute <= startMinute means it ends the next morning. "Resting now" and the overnight pieces are never stored.

export interface QuietTimeLike {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface Segment<T extends QuietTimeLike = QuietTimeLike> {
  row: T;
  /** Minutes since midnight on the day being drawn; endMinute may be 1440. */
  startMinute: number;
  endMinute: number;
  /** 'start' = the row's own day (an overnight row runs to 24:00); 'tail' = the next-morning part (00:00 to the end). */
  part: 'start' | 'tail';
  /** The block continues past the bottom (an overnight start) or comes from above (a tail). */
  continuesNext: boolean;
  continuesPrev: boolean;
}

const WEEK_MINUTES = 7 * MINUTES_PER_DAY;

export function isOvernightRow(row: QuietTimeLike): boolean {
  return row.endMinute <= row.startMinute;
}

/** The pieces of `rows` that fall on `date`'s calendar day. An overnight row gives start -> 24:00 on its day and 00:00 -> end on the next. */
export function segmentsForDay<T extends QuietTimeLike>(rows: readonly T[], date: Date): Segment<T>[] {
  const day = date.getDay();
  const previous = (day + 6) % 7;
  const out: Segment<T>[] = [];
  for (const row of rows) {
    const overnight = isOvernightRow(row);
    if (row.dayOfWeek === day) {
      out.push({
        row,
        startMinute: row.startMinute,
        endMinute: overnight ? MINUTES_PER_DAY : row.endMinute,
        part: 'start',
        continuesNext: overnight,
        continuesPrev: false,
      });
    }
    if (overnight && row.dayOfWeek === previous) {
      out.push({ row, startMinute: 0, endMinute: row.endMinute, part: 'tail', continuesNext: false, continuesPrev: true });
    }
  }
  return out.sort((a, b) => a.startMinute - b.startMinute);
}

/** The segment covering this moment, or null. */
export function restingSegment<T extends QuietTimeLike>(rows: readonly T[], now: Date): Segment<T> | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  for (const s of segmentsForDay(rows, now)) {
    if (s.startMinute <= minute && minute < s.endMinute) return s;
  }
  return null;
}

export function isRestingNow(rows: readonly QuietTimeLike[], now: Date): boolean {
  return restingSegment(rows, now) !== null;
}

/** When the quiet time that covers `now` ends, as a minute of the day (so 7:00 AM is 420 even when it started last night). */
export function restingUntil(rows: readonly QuietTimeLike[], now: Date): number | null {
  const s = restingSegment(rows, now);
  return s ? s.row.endMinute : null;
}

/** The next start later today, as a minute of the day, or null. */
export function nextStartToday(rows: readonly QuietTimeLike[], now: Date): number | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  let best: number | null = null;
  for (const row of rows) {
    if (row.dayOfWeek === now.getDay() && row.startMinute > minute && (best === null || row.startMinute < best)) best = row.startMinute;
  }
  return best;
}

function weekRange(dayOfWeek: number, startMinute: number, endMinute: number): [number, number] {
  const start = dayOfWeek * MINUTES_PER_DAY + startMinute;
  const end = dayOfWeek * MINUTES_PER_DAY + endMinute + (endMinute <= startMinute ? MINUTES_PER_DAY : 0);
  return [start, end];
}

export interface Candidate {
  days: readonly number[];
  startMinute: number;
  endMinute: number;
}

/**
 * The circular-week overlap check, identical to the backend's: each row is a minute range
 * `day*1440 + start` to `day*1440 + end` (+1440 if overnight) on a week that wraps at 10080.
 * Returns the existing rows the candidate clashes with (touching ends is fine). Pass only the rows to compare against
 * (your own rows in the house, minus the ones being edited).
 */
export function findOverlaps<T extends QuietTimeLike>(candidate: Candidate, rows: readonly T[]): T[] {
  const ranges = candidate.days.map((d) => weekRange(d, candidate.startMinute, candidate.endMinute));
  return rows.filter((row) => {
    const [c, d] = weekRange(row.dayOfWeek, row.startMinute, row.endMinute);
    return ranges.some(([a, b]) => [-WEEK_MINUTES, 0, WEEK_MINUTES].some((shift) => a < d + shift && c + shift < b));
  });
}

/** "Mon 11:00 PM → 7:00 AM (next day)". */
export function describeRow(row: QuietTimeLike): string {
  return `${dayShort(row.dayOfWeek)} ${formatRange(row.startMinute, row.endMinute)}`;
}

/** "This overlaps your quiet time on Mon 11:00 PM → 7:00 AM (next day)." */
export function overlapMessage(conflicts: readonly QuietTimeLike[]): string {
  const first = conflicts[0];
  return first ? `This overlaps your quiet time on ${describeRow(first)}.` : 'This overlaps another quiet time of yours.';
}

export interface QuietTimeSet<T extends QuietTimeLike & { setId: string }> {
  setId: string;
  rows: T[];
  days: number[];
  startMinute: number;
  endMinute: number;
}

/** Groups rows by setId (rows in a set share start and end). Sets are ordered by their first day, Monday first. */
export function groupSets<T extends QuietTimeLike & { setId: string }>(rows: readonly T[]): QuietTimeSet<T>[] {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.setId, [...(map.get(row.setId) ?? []), row]);
  return [...map.entries()]
    .map(([setId, members]) => ({
      setId,
      rows: members,
      days: sortDays(members.map((r) => r.dayOfWeek)),
      startMinute: members[0].startMinute,
      endMinute: members[0].endMinute,
    }))
    .sort((a, b) => a.startMinute - b.startMinute || a.days[0] - b.days[0]);
}

export { formatMinutes };
