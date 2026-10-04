import { useEffect, useState, type ReactNode } from 'react';
import styles from './StreakTile.module.css';

const COUNT_MS = 700;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Counts 0 -> value over 700ms on arrival. Reduced motion (and later changes, like dropping to 0) show the number at once. */
function useCountUp(value: number): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() || value === 0 ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion() || value === 0) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      // Time from the first painted frame, so a late first frame can't swallow the count-up.
      start ??= t;
      const p = Math.min(1, (t - start) / COUNT_MS);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

interface StreakTileProps {
  days: number;
  /** A slot under the number (slice 7 puts the demo note here). */
  note?: ReactNode;
}

/** The Quiet Streak: whole days since anyone in the house was nudged. Butter is used here and nowhere else. */
export function StreakTile({ days, note }: StreakTileProps) {
  const shown = useCountUp(days);
  return (
    <section className={styles.tile} aria-label="Quiet Streak">
      <span className={styles.chip}>Quiet Streak</span>
      <p className={styles.n} aria-hidden="true">
        {shown}
      </p>
      <p className={styles.label}>
        <span className={styles.sr}>{days} </span>
        {days === 1 ? 'day' : 'days'} without a nudge
      </p>
      {note}
    </section>
  );
}
