import { useId, useState } from 'react';
import { CircleAlert, Trash2 } from 'lucide-react';
import { ApiError } from '../../api/client';
import { conflictsFromError, useCreateQuietTime, useDeleteQuietTime, useUpdateQuietTime } from '../../api/hooks/quietTimes';
import type { BoardQuietTime, QuietTimeScope } from '../../api/types';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { describeRow, findOverlaps, overlapMessage } from '../../lib/quietTime';
import { WEEK_ORDER, dayShort, formatDays, formatMinutes, formatRange, isOvernight, sortDays, timeOptions } from '../../lib/time';
import styles from './QuietTimeEditor.module.css';

interface QuietTimeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  houseId: string;
  /** All of your own quiet times in this house (for the overlap check and for the sets). */
  ownRows: BoardQuietTime[];
  /** A row you tapped to edit, or null to add. */
  editing: BoardQuietTime | null;
  /** Called after a successful save or delete. */
  onDone?: () => void;
}

/** The quiet-time editor: a bottom sheet. Add, or edit/delete with "Just this day" / "All days in this set". */
export function QuietTimeEditor({ open, onOpenChange, ...rest }: QuietTimeEditorProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={rest.editing ? 'Edit quiet time' : 'New quiet time'}>
      <EditorForm {...rest} close={() => onOpenChange(false)} />
    </Sheet>
  );
}

const OPTIONS = timeOptions();

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.isNetwork) return "Can't reach Hushmate right now. Your times are still here. Try again in a moment.";
  if (error instanceof ApiError && error.status === 403) return error.messages[0] ?? "You can only change quiet times in your active house.";
  return 'Something went wrong. Your times are still here. Try again in a moment.';
}

function EditorForm({ houseId, ownRows, editing, onDone, close }: Omit<QuietTimeEditorProps, 'open' | 'onOpenChange'> & { close: () => void }) {
  const ids = useId();
  const setRows = editing ? ownRows.filter((r) => r.setId === editing.setId) : [];
  const [start, setStart] = useState(editing?.startMinute ?? 23 * 60);
  const [end, setEnd] = useState(editing?.endMinute ?? 7 * 60);
  const [days, setDays] = useState<number[]>(editing ? setRows.map((r) => r.dayOfWeek) : [1, 3, 5]);
  const [conflict, setConflict] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [askScope, setAskScope] = useState<'save' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = useCreateQuietTime(houseId);
  const update = useUpdateQuietTime();
  const remove = useDeleteQuietTime();
  const working = create.isPending || update.isPending || remove.isPending;

  const overnight = isOvernight(start, end);
  const sameTime = start === end;
  const noDays = days.length === 0;
  const blocked = sameTime || noDays || conflict !== null;
  const inSet = setRows.length > 1;
  const describedBy = conflict ? `${ids}-conflict` : undefined;

  function changed<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setConflict(null);
      setFailure(null);
    };
  }

  function toggleDay(day: number) {
    changed(setDays)(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
  }

  async function run(scope: QuietTimeScope | null) {
    setFailure(null);
    setConflict(null);
    // The rows being edited don't count against the edit; everything else of yours does.
    const excluded = !editing ? [] : scope === 'day' ? [editing] : setRows;
    const others = ownRows.filter((r) => !excluded.includes(r));
    const candidateDays = !editing ? days : scope === 'day' ? [editing.dayOfWeek] : setRows.map((r) => r.dayOfWeek);
    const clashes = findOverlaps({ days: candidateDays, startMinute: start, endMinute: end }, others);
    if (clashes.length > 0) {
      setConflict(overlapMessage(clashes));
      return;
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, startMinute: start, endMinute: end, scope: scope ?? 'set' });
      else await create.mutateAsync({ days: sortDays(days), startMinute: start, endMinute: end });
      onDone?.();
      close();
    } catch (error) {
      const clashing = conflictsFromError(error);
      if (clashing) setConflict(overlapMessage(clashing));
      else setFailure(errorText(error));
    }
  }

  async function runDelete(scope: QuietTimeScope) {
    if (!editing) return;
    setFailure(null);
    try {
      await remove.mutateAsync({ id: editing.id, scope });
      onDone?.();
      close();
    } catch (error) {
      setFailure(errorText(error));
    }
  }

  function save() {
    if (working) return;
    if (blocked) return;
    if (editing && inSet) setAskScope('save');
    else void run(editing ? 'set' : null);
  }

  const dayName = editing ? dayShort(editing.dayOfWeek) : '';

  return (
    <>
      <div className={styles.stack}>
        <div className={styles.group}>
          <label className={styles.row}>
            <span>Starts</span>
            <select className={styles.select} value={start} onChange={(e) => changed(setStart)(Number(e.target.value))} aria-label="Start time">
              {OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {formatMinutes(m)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.row}>
            <span>Ends</span>
            <span className={styles.endWrap}>
              {overnight && !sameTime && <span className={styles.next}>(next day)</span>}
              <select className={styles.select} value={end} onChange={(e) => changed(setEnd)(Number(e.target.value))} aria-label={overnight && !sameTime ? 'End time (next day)' : 'End time'}>
                {OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatMinutes(m)}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Repeats</span>
          <div className={styles.days} role="group" aria-label="Days it starts on">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                className={styles.chip}
                aria-pressed={days.includes(d)}
                aria-disabled={editing ? true : undefined}
                onClick={() => !editing && toggleDay(d)}
              >
                {dayShort(d)}
              </button>
            ))}
          </div>
          <p className={styles.cap}>
            {editing
              ? 'The days can’t change here. To move a quiet time to other days, delete it and add a new one.'
              : overnight && !sameTime
                ? <>Days are the nights it <b>starts</b>. This one ends the next morning.</>
                : 'Days are when it starts.'}
          </p>
        </div>

        {!noDays && (
          <p className={styles.summary}>
            <b>{formatRange(start, end)}</b>
            <br />
            {formatDays(days)}
          </p>
        )}
        {noDays && (
          <p className={styles.hint}>
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            Pick at least one day.
          </p>
        )}
        {sameTime && (
          <p className={styles.hint}>
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            Start and end can't be the same time.
          </p>
        )}
        {conflict && (
          <div className={styles.banner} role="alert" id={`${ids}-conflict`}>
            <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
            <div>
              <p className={styles.bannerTitle}>Overlaps another quiet time</p>
              <p className={styles.bannerText}>{conflict}</p>
            </div>
          </div>
        )}
        {failure && (
          <div className={styles.banner} role="alert">
            <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
            <div>
              <p className={styles.bannerTitle}>Couldn't save</p>
              <p className={styles.bannerText}>{failure}</p>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Button block busy={create.isPending || update.isPending} disabled={blocked} aria-describedby={describedBy} onClick={save}>
            {create.isPending || update.isPending ? 'Saving…' : 'Save quiet time'}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              danger
              block
              busy={remove.isPending}
              icon={<Trash2 size={18} strokeWidth={2} aria-hidden="true" />}
              onClick={() => (inSet ? setAskScope('delete') : setConfirmDelete(true))}
            >
              Delete quiet time
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={askScope === 'save'}
        onOpenChange={(o) => !o && setAskScope(null)}
        title="Change which days?"
        description={`This quiet time repeats on ${formatDays(days)} nights.`}
      >
        <Button block onClick={() => { setAskScope(null); void run('set'); }}>
          All days in this set
        </Button>
        <Button variant="secondary" block onClick={() => { setAskScope(null); void run('day'); }}>
          Just this day ({dayName})
        </Button>
        <Button variant="ghost" block onClick={() => setAskScope(null)}>
          Cancel
        </Button>
      </ConfirmDialog>

      <ConfirmDialog
        open={askScope === 'delete'}
        onOpenChange={(o) => !o && setAskScope(null)}
        title="Delete this quiet time?"
        description={`It repeats on ${formatDays(days)} nights.`}
      >
        <Button variant="secondary" danger block onClick={() => { setAskScope(null); void runDelete('set'); }}>
          Delete all days in this set
        </Button>
        <Button variant="secondary" danger block onClick={() => { setAskScope(null); void runDelete('day'); }}>
          Delete just this day ({dayName})
        </Button>
        <Button variant="ghost" block onClick={() => setAskScope(null)}>
          Cancel
        </Button>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this quiet time?"
        description={editing ? describeRow(editing) : undefined}
      >
        <Button variant="secondary" danger block onClick={() => { setConfirmDelete(false); void runDelete('set'); }}>
          Delete quiet time
        </Button>
        <Button variant="ghost" block onClick={() => setConfirmDelete(false)}>
          Cancel
        </Button>
      </ConfirmDialog>
    </>
  );
}
