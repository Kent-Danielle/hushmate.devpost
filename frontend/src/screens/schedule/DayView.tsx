import { useEffect, useRef, type CSSProperties } from 'react';
import type { BoardMember, BoardQuietTime } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { mateFill, mateInk } from '../../lib/colors';
import { restingSegment, segmentsForDay } from '../../lib/quietTime';
import { MINUTES_PER_DAY, formatHour, formatMinutes, formatRange, isSameDay, minuteOfDay } from '../../lib/time';
import styles from './DayView.module.css';
import { useDragScroll } from './useDragScroll';
import { useScrollEdges } from './useScrollEdges';

export const HOUR_PX = 48;
const PX_PER_MINUTE = HOUR_PX / 60;
const GRID_HEIGHT = 24 * HOUR_PX;
/** Height of the pinned lane heads (and the corner cell); keep in sync with `.laneHead` in DayView.module.css. */
const HEAD_H = 60;

interface DayViewProps {
  members: BoardMember[];
  quietTimes: BoardQuietTime[];
  date: Date;
  now: Date;
  /** Tapping your own block opens the editor. */
  onEdit: (row: BoardQuietTime) => void;
}

/** One lane per person, "you" first. Overnight quiet times are drawn as two pieces that join across midnight. */
export default function DayView({ members, quietTimes, date, now, onEdit }: DayViewProps) {
  const isToday = isSameDay(date, now);
  const nowTop = minuteOfDay(now) * PX_PER_MINUTE;

  // Once per date shown: today -> the now line about a third down the visible grid; other days -> the earliest block, else about 7 AM.
  // The grid scrolls inside its own container (the page itself never scrolls on this screen).
  const dateKey = date.toDateString();
  const scrolledFor = useRef<string | null>(null);
  const calRef = useDragScroll<HTMLDivElement>();
  useScrollEdges(calRef);
  useEffect(() => {
    if (scrolledFor.current === dateKey) return;
    const frame = requestAnimationFrame(() => {
      const cal = calRef.current;
      if (!cal) return;
      scrolledFor.current = dateKey; // set here, so a StrictMode double-run (which cancels the first frame) still scrolls
      let minute: number;
      let fraction: number;
      if (isToday) {
        minute = minuteOfDay(now);
        fraction = 1 / 3;
      } else {
        const starts = members.flatMap((m) => segmentsForDay(quietTimes.filter((q) => q.userId === m.id), date).map((s) => s.startMinute));
        minute = starts.length > 0 ? Math.min(...starts) : 7 * 60;
        fraction = 0.1;
      }
      // The pinned lane heads cover the top HEAD_H of the scroller, so measure the fraction against the visible grid below them.
      const visibleGrid = Math.max(0, cal.clientHeight - HEAD_H);
      cal.scrollTo({ top: Math.max(0, minute * PX_PER_MINUTE - visibleGrid * fraction), behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
    // only when a new date is first shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const ordered = [...members].sort((a, b) => Number(b.isYou) - Number(a.isYou));

  return (
    <div className={styles.wrap}>
      <div className={styles.cal} ref={calRef} tabIndex={0} role="group" aria-label="Day view, 24 hours, one lane per person">
        <div className={styles.grid} style={{ '--lanes': ordered.length } as CSSProperties}>
          <div className={styles.gutter}>
            <div className={styles.corner} />
            <div className={styles.hours} style={{ height: GRID_HEIGHT }}>
              {Array.from({ length: 24 }, (_, h) => h)
                .filter((h) => !(isToday && Math.abs(h * HOUR_PX - nowTop) < 16))
                .map((h) => (
                  <span key={h} style={{ top: h * HOUR_PX }}>
                    {formatHour(h)}
                  </span>
                ))}
              {isToday && (
                <span className={styles.nowLabel} style={{ top: nowTop }}>
                  {formatMinutes(minuteOfDay(now))}
                </span>
              )}
            </div>
          </div>
          {ordered.map((member) => {
            const rows = quietTimes.filter((q) => q.userId === member.id);
            const resting = !member.isAway && isToday && restingSegment(rows, now) !== null;
            return (
              <div className={styles.lane} key={member.id}>
                <div className={styles.laneHead}>
                  <Avatar name={member.name} colorIndex={member.colorIndex} you={member.isYou} size="sm" resting={resting} />
                  <span className={styles.name}>{member.isYou ? 'You' : member.name}</span>
                </div>
                <div className={styles.laneBody} style={{ height: GRID_HEIGHT }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div className={styles.hl} key={h} style={{ top: h * HOUR_PX }} />
                  ))}
                  {segmentsForDay(rows, date).map((seg) => {
                    const row = seg.row;
                    const top = seg.startMinute * PX_PER_MINUTE;
                    const height = (Math.min(seg.endMinute, MINUTES_PER_DAY) - seg.startMinute) * PX_PER_MINUTE;
                    const label = member.isYou ? 'You' : member.name;
                    const range = formatRange(row.startMinute, row.endMinute);
                    const aria = `${label}, quiet time ${range.replace('→', 'to')}${member.isAway ? ', away' : ''}`;
                    const cls = [
                      styles.blk,
                      member.isAway && styles.out,
                      seg.continuesNext && styles.contBot,
                      seg.continuesPrev && styles.contTop,
                      height < 40 && styles.tiny,
                    ]
                      .filter(Boolean)
                      .join(' ');
                    const style = member.isAway
                      ? { top, height, color: mateInk(member.colorIndex, member.isYou) }
                      : { top, height, background: mateFill(member.colorIndex, member.isYou) };
                    const content = (
                      <>
                        <b>{label}</b>
                        {member.isAway && height >= 34 && <span>away</span>}
                        {height >= 62 && (
                          <>
                            <span className={styles.nowrap}>{formatMinutes(row.startMinute)}</span>
                            <span className={styles.nowrap}>→ {formatMinutes(row.endMinute)}</span>
                          </>
                        )}
                      </>
                    );
                    const key = `${row.id}-${seg.part}`;
                    return member.isYou ? (
                      <button key={key} type="button" className={`${cls} ${styles.btn}`} style={style} aria-label={`${aria}. Edit`} onClick={() => onEdit(row)}>
                        {content}
                      </button>
                    ) : (
                      <div key={key} role="group" className={cls} style={style} aria-label={aria}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {isToday && <div className={styles.now} style={{ top: HEAD_H + nowTop }} aria-hidden="true" />}
        </div>
      </div>
      {/* "More lanes this way" hints: soft edge fades, shown while there is more to scroll to on that side. */}
      <div className={`${styles.fade} ${styles.fadeStart}`} aria-hidden="true" />
      <div className={`${styles.fade} ${styles.fadeEnd}`} aria-hidden="true" />
    </div>
  );
}
