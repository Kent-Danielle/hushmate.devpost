import { useNavigate, useParams } from 'react-router';
import { useHouses, useSetupDone } from '../../api/hooks/houses';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import styles from './Onboarding.module.css';

/** Temporary Setup stand-in until build slice 5 (quiet times, notifications). It only finishes setup and moves on. */
export default function SetupPlaceholder() {
  const { houseId } = useParams();
  const navigate = useNavigate();
  const houses = useHouses();
  const setupDone = useSetupDone();
  const item = houses.data?.find((h) => h.house.id === houseId);

  async function finish() {
    if (item) {
      try {
        await setupDone.mutateAsync(item.membershipId);
      } catch {
        // Setup is optional: carry on to Schedule either way.
      }
    }
    navigate('/schedule', { replace: true });
  }

  return (
    <main className={styles.screen}>
      <div className={styles.center}>
        <EmptyState title={item ? `You're in ${item.house.name}` : "You're in"} caption="Quiet times and notification setup are coming soon." />
      </div>
      <div className={styles.bottom}>
        <Button block busy={setupDone.isPending} onClick={() => void finish()}>
          Go to Schedule
        </Button>
      </div>
    </main>
  );
}
