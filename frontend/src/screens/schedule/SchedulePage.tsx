import { useState } from 'react';
import { BellRing, ChevronLeft, ChevronRight, CircleAlert, Plus, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useBoard } from '../../api/hooks/board';
import { useCountdown } from '../../api/hooks/nudges';
import { useHouses } from '../../api/hooks/houses';
import type { BoardQuietTime } from '../../api/types';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { CooldownPill } from '../../components/CooldownPill';
import { EmptyState } from '../../components/EmptyState';
import { addDays, formatDate, formatWeek, startOfDay, startOfWeek } from '../../lib/time';
import DayView from './DayView';
import { NudgeSheet } from './NudgeSheet';
import { QuietTimeEditor } from './QuietTimeEditor';
import WeekView from './WeekView';
import { useNow } from './useNow';
import styles from '../Placeholder.module.css';
import local from './SchedulePage.module.css';

type View = 'day' | 'week';

/** The home tab: everyone's quiet times side by side (day view), or a week of thin stripes. */
export default function SchedulePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const houses = useHouses();
  const now = useNow();
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BoardQuietTime | null>(null);
  const cooldown = useCountdown(user?.nudgeCooldownUntil);

  const houseId = user?.activeHouseId ?? null;
  const board = useBoard(houseId);

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
  const members = board.data?.members ?? [];
  const quietTimes = board.data?.quietTimes ?? [];
  const myId = members.find((m) => m.isYou)?.id;
  const ownRows = quietTimes.filter((q) => q.userId === myId);
  const nobodyHasAny = board.isSuccess && quietTimes.length === 0;
  const onlyMineMissing = board.isSuccess && quietTimes.length > 0 && ownRows.length === 0;
  const weekStart = startOfWeek(date);

  function openAdd() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(row: BoardQuietTime) {
    setEditing(row);
    setEditorOpen(true);
  }
  function step(direction: 1 | -1) {
    setDate((d) => addDays(d, direction * (view === 'week' ? 7 : 1)));
  }

  return (
    <section className={styles.wrap}>
      <div className={local.head}>
        <div>
          <h1 className={styles.title}>Schedule</h1>
          {activeHouse && <p className={styles.caption}>{activeHouse.name}</p>}
        </div>
        {houseId && (
          <button type="button" className={`${local.iconBtn} ${local.filled}`} aria-label="Add quiet time" onClick={openAdd}>
            <Plus size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={local.dateBar}>
        <div className={local.date}>
          <button type="button" className={local.iconBtn} aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => step(-1)}>
            <ChevronLeft size={24} strokeWidth={2} aria-hidden="true" />
          </button>
          <span aria-live="polite">{view === 'week' ? formatWeek(weekStart) : formatDate(date)}</span>
          <button type="button" className={local.iconBtn} aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => step(1)}>
            <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className={local.seg} role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>
            Day
          </button>
          <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>
            Week
          </button>
        </div>
      </div>

      {board.isError && (
        <div className={local.net} role="status">
          {board.error instanceof ApiError && board.error.isNetwork ? <WifiOff size={20} strokeWidth={2} aria-hidden="true" /> : <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />}
          <span className={local.netText}>{board.error instanceof ApiError && board.error.isNetwork ? "Can't reach Hushmate right now." : "Couldn't load the schedule."}</span>
          <Button variant="ghost" small onClick={() => void board.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {onlyMineMissing && (
        <div className={local.strip}>
          <div className={local.stripText}>
            <b>No quiet times yet</b>
            <span>Totally optional. Add yours when you like.</span>
          </div>
          <Button variant="ghost" small onClick={openAdd}>
            Add quiet time
          </Button>
        </div>
      )}

      {board.isPending && houseId && (
        <div className={local.skeleton} aria-busy="true" aria-label="Loading the schedule">
          {[0, 1, 2].map((i) => (
            <div key={i} className={local.skLane} />
          ))}
        </div>
      )}

      {board.data && (
        <div className={local.gridWrap}>
          {view === 'day' ? (
            <DayView members={members} quietTimes={quietTimes} date={date} now={now} onEdit={openEdit} />
          ) : (
            <WeekView
              members={members}
              quietTimes={quietTimes}
              weekStart={weekStart}
              now={now}
              onOpenDay={(d) => {
                setDate(startOfDay(d));
                setView('day');
              }}
            />
          )}
          {nobodyHasAny && (
            <div className={local.overlay}>
              <div className={local.card}>
                <EmptyState
                  title="No quiet times yet"
                  caption="Add yours so your housemates know when to keep it down."
                  action={<Button onClick={openAdd}>Add quiet time</Button>}
                />
              </div>
            </div>
          )}
        </div>
      )}

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
          <QuietTimeEditor open={editorOpen} onOpenChange={setEditorOpen} houseId={houseId} ownRows={ownRows} editing={editing} />
        </>
      )}
    </section>
  );
}
