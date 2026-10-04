import { useNavigate } from 'react-router';
import { useHouses } from '../../api/hooks/houses';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import Placeholder from '../Placeholder';
import styles from '../Placeholder.module.css';
import local from './SchedulePage.module.css';

/** Build slice 4 builds the real calendar. Until then: the waiting-for-approval empty state, and a placeholder otherwise. */
export default function SchedulePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const houses = useHouses();

  if (user && user.activeHouseId === null && houses.data) {
    const pending = houses.data.find((h) => h.status === 'pending');
    return (
      <section className={styles.wrap}>
        <div>
          <h1 className={styles.title}>Schedule</h1>
          <p className={styles.caption}>No active house yet</p>
        </div>
        <div className={local.center}>
          <EmptyState
            title={pending ? "You're on the list" : 'No house yet'}
            caption={
              pending
                ? `${pending.house.name}'s owner needs to say yes. Once you're in, you'll set up your quiet times.`
                : 'Create a house for your housemates, or join the one you already share.'
            }
            action={<Button onClick={() => navigate('/houses', { state: { openCreate: true } })}>Create a house</Button>}
          />
        </div>
      </section>
    );
  }
  return <Placeholder title="Schedule" />;
}
