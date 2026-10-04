// Wall-clock helpers. Times are minutes since midnight (0-1425 in steps of 15) and are read in the phone's local time.
// Days follow JavaScript's getDay(): 0 = Sunday ... 6 = Saturday. The UI shows Monday first.

export const MINUTES_PER_DAY = 1440;
export const STEP_MINUTES = 15;

/** Day numbers in the order the UI shows them: Monday first. */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function dayShort(day: number): string {
  return DAY_SHORT[((day % 7) + 7) % 7];
}

/** 0 -> "12:00 AM", 1380 -> "11:00 PM", 1440 -> "12:00 AM". */
export function formatMinutes(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** An hour label for the grid: "12 AM", "1 PM". */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

/** end <= start means the quiet time ends the next morning. */
export function isOvernight(startMinute: number, endMinute: number): boolean {
  return endMinute <= startMinute;
}

/** "11:00 PM → 7:00 AM", with " (next day)" appended when it runs overnight and `withNextDay` is set. */
export function formatRange(startMinute: number, endMinute: number, withNextDay = true): string {
  const base = `${formatMinutes(startMinute)} → ${formatMinutes(endMinute)}`;
  return withNextDay && isOvernight(startMinute, endMinute) ? `${base} (next day)` : base;
}

/** Every pickable time: 0, 15, ... 1425. */
export function timeOptions(): number[] {
  const out: number[] = [];
  for (let m = 0; m < MINUTES_PER_DAY; m += STEP_MINUTES) out.push(m);
  return out;
}

/** Sorts day numbers Monday first, without duplicates. */
export function sortDays(days: readonly number[]): number[] {
  return WEEK_ORDER.filter((d) => days.includes(d));
}

/** "Mon, Wed, Fri" (Monday first). */
export function formatDays(days: readonly number[]): string {
  return sortDays(days).map(dayShort).join(', ');
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The Monday on or before `date` (the week starts Monday in the UI). */
export function startOfWeek(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -offset);
}

/** The minute of the day for a moment: 21:40 -> 1300. */
export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** "Thu, Oct 8". */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Oct 5 – 11" or "Sep 28 – Oct 4". */
export function formatWeek(monday: Date): string {
  const sunday = addDays(monday, 6);
  const a = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const b = sameMonth ? String(sunday.getDate()) : sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}
