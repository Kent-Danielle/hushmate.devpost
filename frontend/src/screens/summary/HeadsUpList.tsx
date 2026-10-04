import { Plus } from 'lucide-react';
import type { SummaryHeadsUp } from '../../api/types';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useNow } from '../schedule/useNow';
import { formatHeadsUpTime } from './headsUpTime';
import styles from './HeadsUpList.module.css';

interface HeadsUpListProps {
  headsUps: SummaryHeadsUp[];
  onPost: () => void;
}

/** Heads-ups with the author's name, soonest first. One whose time has passed drops off without waiting for the next refetch. */
export function HeadsUpList({ headsUps, onPost }: HeadsUpListProps) {
  const now = useNow(15_000);
  const live = headsUps.filter((h) => Date.parse(h.at) > now.getTime()).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return (
    <section className={styles.section} aria-labelledby="heads-h">
      <div className={styles.head}>
        <h2 id="heads-h" className={styles.h}>
          Heads-ups
        </h2>
        <Button variant="ghost" small icon={<Plus size={20} strokeWidth={2} aria-hidden="true" />} onClick={onPost}>
          Post
        </Button>
      </div>
      {live.length === 0 ? (
        <EmptyState
          title="No heads-ups yet"
          caption="Late dinner? Friends coming over? Let the house know."
          action={<Button onClick={onPost}>Post a heads-up</Button>}
        />
      ) : (
        <ul className={styles.list}>
          {live.map((h) => (
            <li key={h.id} className={styles.card}>
              <span className={styles.time}>{formatHeadsUpTime(h.at, now)}</span>
              <p className={styles.text}>{h.text}</p>
              <span className={styles.author}>{h.authorName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
