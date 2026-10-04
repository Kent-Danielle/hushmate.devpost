import { useEffect } from 'react';
import { CircleAlert } from 'lucide-react';
import { useBoard } from '../../api/hooks/board';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { restingUntil } from '../../lib/quietTime';
import { formatMinutes } from '../../lib/time';
import { useNow } from '../schedule/useNow';
import styles from './RestingNow.module.css';

/** Housemates (not you, not anyone away) whose quiet time is in progress, worked out on the phone from the board. */
export function RestingNow({ houseId }: { houseId: string }) {
  const board = useBoard(houseId);
  const now = useNow();
  const refetch = board.refetch;

  // Quiet times can change while Summary is open: re-read the board every 30 s while visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refetch]);

  let body;
  if (board.isPending) {
    body = <div className={styles.skeleton} aria-busy="true" aria-label="Loading who is resting" />;
  } else if (board.isError) {
    body = (
      <div className={styles.error} role="alert">
        <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
        <div>
          <p className={styles.errorTitle}>Couldn't check who is resting</p>
          <Button variant="ghost" small onClick={() => void board.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  } else {
    const resting = board.data.members
      .filter((m) => !m.isYou && !m.isAway)
      .map((m) => ({ m, until: restingUntil(board.data.quietTimes.filter((q) => q.userId === m.id), now) }))
      .filter((r): r is { m: (typeof r)['m']; until: number } => r.until !== null);
    body =
      resting.length === 0 ? (
        <EmptyState title="The house is wide awake" caption="Nobody is in a quiet time right now." />
      ) : (
        <ul className={styles.list}>
          {resting.map(({ m, until }) => (
            <li key={m.id} className={styles.li}>
              <Avatar name={m.name} colorIndex={m.colorIndex} resting />
              <div className={styles.who}>
                <b className={styles.name}>{m.name}</b>
                <span className={styles.cap}>Until {formatMinutes(until)}</span>
              </div>
            </li>
          ))}
        </ul>
      );
  }

  return (
    <section className={styles.section} aria-labelledby="resting-h">
      <h2 id="resting-h" className={styles.h}>
        Resting now
      </h2>
      {body}
    </section>
  );
}
