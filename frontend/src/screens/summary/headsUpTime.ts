import { addDays, formatMinutes, startOfDay } from '../../lib/time';

/** "Today · 11:30 PM", "Tomorrow · 8:00 PM", "Sat, Oct 10 · 8:00 PM", in the phone's local time. */
export function formatHeadsUpTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const today = startOfDay(now).getTime();
  const day = startOfDay(at).getTime();
  const time = formatMinutes(at.getHours() * 60 + at.getMinutes());
  let label: string;
  if (day === today) label = 'Today';
  else if (day === addDays(startOfDay(now), 1).getTime()) label = 'Tomorrow';
  else label = at.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${label} · ${time}`;
}
