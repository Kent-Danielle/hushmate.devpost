import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import styles from './Onboarding.module.css';

/** The end of a join request: nothing else is offered until the owner says yes. Shared by onboarding and the invite-link page. */
export default function RequestSentStep({ houseName }: { houseName: string }) {
  const navigate = useNavigate();
  return (
    <main className={styles.screen}>
      <div className={styles.center}>
        <EmptyState
          title="Request sent"
          caption={`${houseName}'s owner will see it in Houses. Once you're in, you'll set up your quiet times and notifications.`}
        />
      </div>
      <div className={styles.bottom}>
        <Button block onClick={() => navigate('/schedule')}>
          Go to Schedule
        </Button>
      </div>
    </main>
  );
}
