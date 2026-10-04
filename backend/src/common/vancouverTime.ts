// America/Vancouver helpers using Intl only (no date library).
const ZONE = 'America/Vancouver';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock parts of an instant in Vancouver. */
export function vancouverParts(date: Date): LocalParts {
  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour!,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Milliseconds Vancouver is ahead of UTC at an instant (negative: -7h or -8h). */
function offsetMs(date: Date): number {
  const p = vancouverParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant for a Vancouver wall-clock time (valid for times that aren't in a DST gap or overlap, like 03:00). */
function vancouverToInstant(year: number, month: number, day: number, hour: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  let result = guess - offsetMs(new Date(guess));
  // The offset at the guess can differ from the offset at the result around a transition.
  result = guess - offsetMs(new Date(result));
  return new Date(result);
}

/** The most recent 03:00 America/Vancouver at or before `now`. */
export function latestVancouver3am(now: Date = new Date()): Date {
  const p = vancouverParts(now);
  let { year, month, day } = p;
  if (p.hour < 3) {
    const previous = new Date(Date.UTC(year, month - 1, day - 1));
    year = previous.getUTCFullYear();
    month = previous.getUTCMonth() + 1;
    day = previous.getUTCDate();
  }
  return vancouverToInstant(year, month, day, 3);
}

function dayNumber(date: Date): number {
  const p = vancouverParts(date);
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

/** Whole Vancouver calendar days from `from` to `to` (never negative). */
export function vancouverDaysBetween(from: Date, to: Date): number {
  return Math.max(0, dayNumber(to) - dayNumber(from));
}
