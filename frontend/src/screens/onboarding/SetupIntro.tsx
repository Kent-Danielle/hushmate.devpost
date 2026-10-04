import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import styles from './Onboarding.module.css';

/** Joiners only: shown the first time the app opens after the owner approves. Creators skip it. */
export default function SetupIntro({ houseName, onContinue }: { houseName: string; onContinue: () => void }) {
  return (
    <main className={styles.screen}>
      <div className={styles.center}>
        <EmptyState title={`You're in ${houseName}`} caption="Let's set up your quiet times and notifications. Both are optional." />
      </div>
      <div className={styles.bottom}>
        <Button block onClick={onContinue}>
          Let's go
        </Button>
      </div>
    </main>
  );
}
