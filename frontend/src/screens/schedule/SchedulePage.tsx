import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useCountdown } from '../../api/hooks/nudges';
import { useHouses } from '../../api/hooks/houses';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { CooldownPill } from '../../components/CooldownPill';
import { EmptyState } from '../../components/EmptyState';
import { NudgeSheet } from './NudgeSheet';
import styles from '../Placeholder.module.css';
import local from './SchedulePage.module.css';

/** The day view arrives in slice 5. Until then: the waiting-for-approval empty state, or the header and the floating Nudge button. */
export default function SchedulePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const houses = useHouses();
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const cooldown = useCountdown(user?.nudgeCooldownUntil);

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
  const activeHouse = houses.data?.find((h) => h.isActive)?.house;
  const houseId = user?.activeHouseId ?? null;

  return (
    <section className={styles.wrap}>
      <div>
        <h1 className={styles.title}>Schedule</h1>
        {activeHouse && <p className={styles.caption}>{activeHouse.name}</p>}
      </div>
      <div className={local.empty}>
        <p className={local.voice}>The day view is coming soon</p>
        <p className={local.caption}>You can already nudge a housemate, anonymously.</p>
      </div>
      {houseId && (
        <>
          <div className={local.fab}>
            {cooldown > 0 ? (
              <CooldownPill seconds={cooldown} />
            ) : (
              <Button variant="nudge" icon={<BellRing size={20} strokeWidth={2} aria-hidden="true" />} onClick={() => setNudgeOpen(true)}>
                Nudge
              </Button>
            )}
          </div>
          <NudgeSheet open={nudgeOpen} onOpenChange={setNudgeOpen} houseId={houseId} />
        </>
      )}
    </section>
  );
}
