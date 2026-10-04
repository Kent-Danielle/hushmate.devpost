import { useState } from 'react';
import { CircleAlert, Pencil, Plus } from 'lucide-react';
import { useBoard } from '../../api/hooks/board';
import type { BoardQuietTime } from '../../api/types';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { groupSets } from '../../lib/quietTime';
import { formatDays, formatRange } from '../../lib/time';
import { QuietTimeEditor } from '../schedule/QuietTimeEditor';
import styles from './Onboarding.module.css';

interface Props {
  houseId: string;
  houseName: string;
  /** Edits and deletes are only allowed in your active house; adding is always allowed during setup. */
  canEdit: boolean;
  onNext: () => void;
}

/** Setup step 1: optional first quiet times. Reuses the editor. */
export default function QuietTimeStep({ houseId, houseName, canEdit, onNext }: Props) {
  const board = useBoard(houseId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoardQuietTime | null>(null);
  const mine = board.data ? board.data.quietTimes.filter((q) => q.userId === board.data.members.find((m) => m.isYou)?.id) : [];
  const sets = groupSets(mine);

  function add() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <main className={styles.screen}>
      <div className={styles.stepHead}>
        <div className={styles.progress} role="img" aria-label="Step 1 of 2">
          <i className={styles.on} style={{ background: 'var(--hm-brand)' }} />
          <i />
        </div>
        <p className={styles.stepCap}>Step 1 of 2 · Quiet times</p>
        <h1 className={styles.title}>Your quiet times</h1>
        <p className={styles.sub}>
          {sets.length === 0 ? `Totally optional. Pick the times you'd like ${houseName} to keep it down.` : 'Totally optional. You can change these any time in Schedule.'}
        </p>
      </div>

      {board.isError && (
        <div className={styles.error} role="alert">
          <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
          <p>Couldn't load your quiet times. You can skip this and add them later in Schedule.</p>
        </div>
      )}

      {sets.length === 0 ? (
        <EmptyState
          title="No quiet times yet"
          caption="You can join without any, or add yours so housemates know when to go gentle."
          action={<Button onClick={add}>Add quiet time</Button>}
        />
      ) : (
        <>
          <ul className={styles.sets} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sets.map((set) => (
              <li className={styles.set} key={set.setId}>
                <div className={styles.setText}>
                  <b>{formatRange(set.startMinute, set.endMinute)}</b>
                  <span>Starts {formatDays(set.days)} nights</span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Edit quiet time ${formatRange(set.startMinute, set.endMinute)}`}
                    className={styles.iconBtn}
                    onClick={() => {
                      setEditing(set.rows[0]);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={24} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Button variant="secondary" block icon={<Plus size={18} strokeWidth={2} aria-hidden="true" />} onClick={add}>
            Add another
          </Button>
        </>
      )}

      <div className={styles.bottom}>
        {sets.length === 0 ? (
          <Button variant="ghost" block onClick={onNext}>
            Skip for now
          </Button>
        ) : (
          <Button block onClick={onNext}>
            Continue
          </Button>
        )}
      </div>

      <QuietTimeEditor open={open} onOpenChange={setOpen} houseId={houseId} ownRows={mine} editing={editing} />
    </main>
  );
}
