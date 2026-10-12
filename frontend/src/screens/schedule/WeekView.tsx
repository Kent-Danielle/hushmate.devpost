import type { BoardMember, BoardQuietTime } from '../../api/types';
import { mateFill, mateInk } from '../../lib/colors';
import { segmentsForDay } from '../../lib/quietTime';
import { addDays, formatDate, formatHour, isSameDay } from '../../lib/time';
import styles from './WeekView.module.css';

const HOUR_PX = 22;
const PX_PER_MINUTE = HOUR_PX / 60;
const GRID_HEIGHT = 24 * HOUR_PX;

interface WeekViewProps {
  members: BoardMember[];
  quietTimes: BoardQuietTime[];
  /** The Monday that starts the week. */
  weekStart: Date;
  now: Date;
  onOpenDay: (date: Date) => void;
}

/** Seven columns, Monday first. Each person is a thin stripe (filled, or outlined when away) with no text; names live in the legend. */
export default function WeekView({ members, quietTimes, weekStart, now, onOpenDay }: WeekViewProps) {
  const ordered = [...members].sort((a, b) => Number(b.isYou) - Number(a.isYou));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className={styles.root}>
      <div className={styles.weekDays}>
        {days.map((d) => (
          <button key={d.toISOString()} type="button" className={`${styles.wd} ${isSameDay(d, now) ? styles.today : ''}`} aria-label={`Open ${formatDate(d)}`} onClick={() => onOpenDay(d)}>
            {d.toLocaleDateString('en-US', { weekday: 'short' })}
            <b>{d.getDate()}</b>
          </button>
        ))}
      </div>
      <div className={styles.week} role="group" aria-label="Week view. Each thin stripe is one person's quiet time.">
        <div className={styles.gutter} style={{ height: GRID_HEIGHT }}>
          {[0, 6, 12, 18].map((h) => (
            <span key={h} style={{ top: h * HOUR_PX }}>
              {formatHour(h)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div className={styles.day} key={d.toISOString()} style={{ height: GRID_HEIGHT }}>
            {ordered.map((m) => (
              <div className={styles.sub} key={m.id}>
                {segmentsForDay(
                  quietTimes.filter((q) => q.userId === m.id),
                  d,
                ).map((seg) => {
                  const top = seg.startMinute * PX_PER_MINUTE;
                  const height = (seg.endMinute - seg.startMinute) * PX_PER_MINUTE;
                  return (
                    <div
                      key={`${seg.row.id}-${seg.part}`}
                      className={`${styles.stripe} ${m.isAway ? styles.out : ''}`}
                      style={m.isAway ? { top, height, color: mateInk(m.colorIndex, m.isYou) } : { top, height, background: mateFill(m.colorIndex, m.isYou) }}
                    />
                  );
                })}
              </div>
            ))}
            <button type="button" className={styles.hit} tabIndex={-1} aria-hidden="true" onClick={() => onOpenDay(d)} />
          </div>
        ))}
      </div>
      <ul className={styles.legend} aria-label="Who is who">
        {ordered.map((m) => (
          <li key={m.id} style={{ color: mateInk(m.colorIndex, m.isYou) }}>
            <i className={`${styles.sw} ${m.isAway ? styles.swOut : ''}`} style={m.isAway ? undefined : { background: mateFill(m.colorIndex, m.isYou) }} aria-hidden="true" />
            <span className={styles.legendText}>
              {m.isYou ? 'You' : m.name}
              {m.isAway ? ' (away)' : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>Tap a day to open it.{members.some((m) => m.isAway) ? ' Outlined means away.' : ''}</p>
    </div>
  );
}
