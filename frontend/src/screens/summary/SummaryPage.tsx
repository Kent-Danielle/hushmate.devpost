import { useEffect, useState } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useHouses } from '../../api/hooks/houses';
import { useSummary } from '../../api/hooks/summary';
import type { SummaryAck } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { HeadsUpList } from './HeadsUpList';
import { PostHeadsUpSheet } from './PostHeadsUpSheet';
import { RestingNow } from './RestingNow';
import { StreakTile } from './StreakTile';
import { timeAgo } from './timeAgo';
import placeholder from '../Placeholder.module.css';
import styles from './SummaryPage.module.css';

const TOASTED_KEY = 'hushmate-toasted-acks';
const HOUR = 60 * 60 * 1000;

function readToasted(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TOASTED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeToasted(ids: string[]): void {
  try {
    localStorage.setItem(TOASTED_KEY, JSON.stringify(ids.slice(-100)));
  } catch {
    // storage unavailable: the toast may repeat on this device, nothing worse
  }
}

function names(acks: SummaryAck[]): string {
  const unique = [...new Set(acks.map((a) => a.recipientName))];
  if (unique.length <= 1) return unique[0] ?? '';
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

/** Summary: the Quiet Streak, acknowledgement cards (sender only), Resting now and heads-ups. Refetches every 30 s while visible. */
export default function SummaryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const houses = useHouses();
  const houseId = user?.activeHouseId ?? null;
  const summary = useSummary(houseId);
  const [postOpen, setPostOpen] = useState(false);
  const houseName = houses.data?.find((h) => h.isActive)?.house.name;

  // A quiet toast for acknowledgements under an hour old that this device hasn't announced yet.
  const acks = summary.data?.myAcks;
  const dataUpdatedAt = summary.dataUpdatedAt;
  useEffect(() => {
    if (!acks) return;
    const seen = readToasted();
    const fresh = acks
      .filter((a) => !seen.includes(a.nudgeId) && dataUpdatedAt - Date.parse(a.acknowledgedAt) < HOUR)
      .sort((a, b) => Date.parse(a.acknowledgedAt) - Date.parse(b.acknowledgedAt));
    if (fresh.length === 0) return;
    writeToasted([...seen, ...fresh.map((a) => a.nudgeId)]);
    toast.show(`${names(fresh)} tapped Got it`, 'ack');
  }, [acks, dataUpdatedAt, toast]);

  let body;
  if (user && houseId === null) {
    body = (
      <EmptyState
        title="No house yet"
        caption="Once you're in a house, its summary lives here."
        action={<Button onClick={() => navigate('/houses')}>Go to Houses</Button>}
      />
    );
  } else if (summary.isPending) {
    body = <div className={styles.skeleton} aria-busy="true" aria-label="Loading summary" />;
  } else if (summary.isError) {
    body = (
      <div className={styles.error} role="alert">
        <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
        <div>
          <p className={styles.errorTitle}>Couldn't load the summary</p>
          <p className={styles.errorText}>{summary.error.message}</p>
          <Button variant="ghost" small onClick={() => void summary.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  } else {
    const list = [...summary.data.myAcks].sort((a, b) => Date.parse(b.acknowledgedAt) - Date.parse(a.acknowledgedAt));
    body = (
      <>
        <StreakTile days={summary.data.streakDays} demo={user?.isDemo} />
        {list.length > 0 ? (
          <ul className={styles.acks} aria-label="Acknowledged nudges">
            {list.map((ack) => (
              <li key={ack.nudgeId} className={styles.ack}>
                <span className={styles.dot} aria-hidden="true">
                  <Check size={18} strokeWidth={2} />
                </span>
                <div>
                  <p className={styles.voice}>Your nudge was acknowledged</p>
                  <p className={styles.when}>
                    {ack.recipientName} tapped Got it · {timeAgo(ack.acknowledgedAt, dataUpdatedAt || Date.now())}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {houseId && <RestingNow houseId={houseId} />}
        <HeadsUpList headsUps={summary.data.headsUps} onPost={() => setPostOpen(true)} />
      </>
    );
  }

  return (
    <section className={styles.wrap}>
      <div>
        <h1 className={placeholder.title}>Summary</h1>
        {houseName && <p className={placeholder.caption}>{houseName}</p>}
      </div>
      {body}
      {houseId && <PostHeadsUpSheet open={postOpen} onOpenChange={setPostOpen} houseId={houseId} />}
    </section>
  );
}
