/** The circular-week overlap check. Mirrors frontend `lib/quietTime.ts > findOverlaps`; dayOfWeek is 0 = Sunday. */

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export interface QuietRow {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface QuietCandidate {
  days: number[];
  startMinute: number;
  endMinute: number;
}

/** A row as a [start, end) minute range on the week. `end <= start` means it ends the next morning. */
function rangeOf(dayOfWeek: number, startMinute: number, endMinute: number): [number, number] {
  const start = dayOfWeek * MINUTES_PER_DAY + startMinute;
  const end = dayOfWeek * MINUTES_PER_DAY + endMinute + (endMinute <= startMinute ? MINUTES_PER_DAY : 0);
  return [start, end];
}

/** Ranges are shorter than a day, so shifting one by -1, 0 or +1 week covers every wrap at Sunday -> Monday. */
function rangesClash(a: [number, number], b: [number, number]): boolean {
  for (const shift of [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK]) {
    if (a[0] < b[1] + shift && b[0] + shift < a[1]) return true;
  }
  return false;
}

/** The existing rows that the candidate (one range per chosen day) overlaps. Touching ends are not a clash. */
export function findOverlaps(candidate: QuietCandidate, rows: QuietRow[]): QuietRow[] {
  const mine = candidate.days.map((d) => rangeOf(d, candidate.startMinute, candidate.endMinute));
  return rows.filter((row) => {
    const other = rangeOf(row.dayOfWeek, row.startMinute, row.endMinute);
    return mine.some((range) => rangesClash(range, other));
  });
}
