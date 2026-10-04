import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useHouses, useSetupDone } from '../../api/hooks/houses';
import { useAuth } from '../../auth/AuthContext';
import { pushSupported } from '../../push/register';
import NotificationsStep from './NotificationsStep';
import QuietTimeStep from './QuietTimeStep';
import SetupIntro from './SetupIntro';
import styles from './Onboarding.module.css';

type Step = 'intro' | 'quiet' | 'notifications';

function notificationsAlreadyOn(): boolean {
  return pushSupported() && Notification.permission === 'granted';
}

/** /onboarding/setup/:houseId: intro (joiners only), first quiet times, notifications, then setup-done and Schedule. */
export default function SetupFlow() {
  const { houseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const houses = useHouses();
  const setupDone = useSetupDone();
  const item = houses.data?.find((h) => h.house.id === houseId);
  const [step, setStep] = useState<Step | null>(null);

  if (houses.isPending) return <main className={styles.screen} aria-busy="true" />;
  // Unknown, not approved, or already done: nothing to set up.
  if (!item || item.status !== 'approved' || (item.setupDone && !setupDone.isPending && !setupDone.isSuccess)) return <Navigate to="/schedule" replace />;

  const current: Step = step ?? (item.isOwner ? 'quiet' : 'intro');

  async function finish() {
    if (!item) return;
    try {
      await setupDone.mutateAsync(item.membershipId);
      navigate('/schedule', { replace: true });
    } catch {
      // stays on the screen; the step shows a retry message
    }
  }

  if (current === 'intro') return <SetupIntro houseName={item.house.name} onContinue={() => setStep('quiet')} />;
  if (current === 'quiet') {
    return (
      <QuietTimeStep
        houseId={item.house.id}
        houseName={item.house.name}
        canEdit={user?.activeHouseId === item.house.id}
        onNext={() => (notificationsAlreadyOn() ? void finish() : setStep('notifications'))}
      />
    );
  }
  return <NotificationsStep busy={setupDone.isPending} failed={setupDone.isError} onFinish={() => void finish()} />;
}
