import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import NotificationSetup from '../../components/NotificationSetup/NotificationSetup';
import { Button } from '../../components/Button';
import { needsHomeScreen } from '../../push/ios';
import { pushSupported } from '../../push/register';
import styles from './Onboarding.module.css';

interface Props {
  busy: boolean;
  failed: boolean;
  /** Finishes setup (POST setup-done) and goes to Schedule. */
  onFinish: () => void;
}

/** Setup step 2: notification setup, using the shared component. Skipped by the flow when notifications are already On. */
export default function NotificationsStep({ busy, failed, onFinish }: Props) {
  const [enabled, setEnabled] = useState(false);
  // Nothing more can be done here when blocked or unsupported (iPhone in a Safari tab can still add to Home Screen).
  const stuck = !needsHomeScreen() && (!pushSupported() || Notification.permission === 'denied');
  return (
    <main className={styles.screen}>
      <div className={styles.stepHead}>
        <div className={styles.progress} role="img" aria-label="Step 2 of 2">
          <i style={{ background: 'var(--hm-brand)' }} />
          <i style={{ background: 'var(--hm-brand)' }} />
        </div>
        <p className={styles.stepCap}>Step 2 of 2 · Notifications</p>
        <h1 className={styles.title}>{enabled ? 'Notifications are on' : 'Hear about nudges'}</h1>
      </div>
      <NotificationSetup onEnabled={() => setEnabled(true)} />
      {failed && (
        <div className={styles.error} role="alert">
          <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
          <p>Couldn't finish setup. Check your connection and try again.</p>
        </div>
      )}
      <div className={styles.bottom}>
        <Button variant={enabled || stuck ? 'primary' : 'ghost'} block busy={busy} onClick={onFinish}>
          {enabled ? 'Go to Schedule' : stuck ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </main>
  );
}
