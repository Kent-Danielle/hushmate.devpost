import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { ApiError } from '../../api/client';
import { usePostHeadsUp } from '../../api/hooks/summary';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import styles from './PostHeadsUpSheet.module.css';

const MAX = 200;

const pad = (n: number) => String(n).padStart(2, '0');
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** An hour from now, rounded up to the next quarter hour. */
function suggestedTime(): Date {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  return d;
}

/** Local date + time inputs -> Date, or null when either is empty or malformed. */
function parseWhen(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  houseId: string;
}

export function PostHeadsUpSheet({ open, onOpenChange, houseId }: Props) {
  // Remount the form each time the sheet opens so it starts fresh (and the suggested time is current).
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Post a heads-up">
      <HeadsUpForm houseId={houseId} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}

function HeadsUpForm({ houseId, onDone }: { houseId: string; onDone: () => void }) {
  const toast = useToast();
  const post = usePostHeadsUp(houseId);
  const [initial] = useState(suggestedTime);
  const [text, setText] = useState('');
  const [date, setDate] = useState(dateValue(initial));
  const [time, setTime] = useState(timeValue(initial));
  const [whenError, setWhenError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const trimmed = text.trim();
  const canPost = trimmed.length >= 1 && trimmed.length <= MAX;

  function submit() {
    if (!canPost || post.isPending) return;
    const at = parseWhen(date, time);
    if (!at) {
      setWhenError('Pick a date and a time.');
      return;
    }
    if (at.getTime() <= Date.now()) {
      setWhenError("Pick a time that hasn't passed yet.");
      return;
    }
    setWhenError(null);
    setFailure(null);
    post.mutate(
      { text: trimmed, at: at.toISOString() },
      {
        onSuccess: () => {
          toast.show('Heads-up posted');
          onDone();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 400) {
            setFailure(error.message);
          } else if (error instanceof ApiError && !error.isNetwork) {
            setFailure(error.message);
          } else {
            setFailure("Can't reach Hushmate right now. Your words are still here.");
          }
        },
      },
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>What's the plan?</span>
        <textarea
          className={styles.area}
          value={text}
          maxLength={MAX}
          rows={4}
          placeholder="Coming home late, might make late dinner"
          onChange={(e) => setText(e.target.value)}
          aria-describedby="hu-count"
        />
        <span id="hu-count" className={`${styles.counter} ${text.length >= MAX ? styles.max : ''}`}>
          {text.length}/{MAX}
        </span>
      </label>

      <fieldset className={`${styles.field} ${whenError ? styles.invalid : ''}`}>
        <legend className={styles.label}>When</legend>
        <div className={styles.when}>
          <input
            className={styles.input}
            type="date"
            aria-label="Date"
            value={date}
            min={dateValue(new Date())}
            onChange={(e) => {
              setDate(e.target.value);
              setWhenError(null);
            }}
            aria-invalid={whenError ? true : undefined}
          />
          <input
            className={styles.input}
            type="time"
            aria-label="Time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setWhenError(null);
            }}
            aria-invalid={whenError ? true : undefined}
          />
        </div>
        {whenError ? (
          <span className={styles.msgError} role="alert">
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            {whenError}
          </span>
        ) : (
          <span className={styles.msg}>It leaves the board once this time has passed.</span>
        )}
      </fieldset>

      <p className={styles.cap}>Everyone in the house sees your name on it. It won't send a notification.</p>

      {failure && (
        <div className={styles.banner} role="alert">
          <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
          <div>
            <p className={styles.bannerTitle}>Couldn't post</p>
            <p className={styles.bannerText}>{failure}</p>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Button type="submit" block busy={post.isPending} disabled={!canPost}>
          {post.isPending ? 'Posting…' : 'Post heads-up'}
        </Button>
        <Button variant="ghost" block onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
