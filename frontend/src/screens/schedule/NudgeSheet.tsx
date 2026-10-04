import { useState } from 'react';
import { BellRing, CircleAlert, Copy, LoaderCircle } from 'lucide-react';
import { useBoard } from '../../api/hooks/board';
import { ApiError } from '../../api/client';
import { cooldownFromError, formatCountdown, useCountdown, useSendNudge } from '../../api/hooks/nudges';
import type { BoardMember } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { nextStartToday, restingUntil } from '../../lib/quietTime';
import { formatMinutes } from '../../lib/time';
import { useCopyInvite } from '../houses/useCopyInvite';
import styles from './NudgeSheet.module.css';

interface NudgeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  houseId: string;
}

/**
 * "Who's being loud?": the housemates of the active house, except you. Picking one sends the nudge at once.
 * Each row says "Resting now · until …" (picking asks first), "Not resting", or "away" (can't be picked).
 */
export function NudgeSheet({ open, onOpenChange, houseId }: NudgeSheetProps) {
  const { user } = useAuth();
  const toast = useToast();
  const copyInvite = useCopyInvite();
  const board = useBoard(houseId, open);
  const send = useSendNudge();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<BoardMember | null>(null);
  const now = new Date();
  const cooldown = useCountdown(user?.nudgeCooldownUntil);

  const mates = (board.data?.members ?? []).filter((m) => !m.isYou);
  const limited = send.isError && cooldownFromError(send.error) !== null && cooldown > 0;
  const failed = send.isError && !limited;

  function status(member: BoardMember): RowStatus {
    if (member.isAway) return { kind: 'away' };
    const rows = (board.data?.quietTimes ?? []).filter((q) => q.userId === member.id);
    const until = restingUntil(rows, now);
    if (until !== null) return { kind: 'resting', until };
    return { kind: 'idle', next: nextStartToday(rows, now) };
  }

  /** Resting people ask first; away people can't be picked. */
  function choose(member: BoardMember) {
    if (send.isPending) return;
    if (status(member).kind === 'resting') setConfirming(member);
    else pick(member);
  }

  function pick(member: BoardMember) {
    if (send.isPending) return;
    setSendingId(member.id);
    send.mutate(member.id, {
      onSuccess: () => {
        toast.show('Nudge sent quietly');
        onOpenChange(false);
      },
      onSettled: () => setSendingId(null),
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) send.reset();
    onOpenChange(next);
  }

  function restingUntilFor(member: BoardMember): number {
    const s = status(member);
    return s.kind === 'resting' ? s.until : 0;
  }

  let body;
  if (board.isPending) {
    body = (
      <div className={styles.list} aria-busy="true" aria-label="Loading housemates">
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  } else if (board.isError) {
    body = (
      <div className={styles.banner} role="alert">
        <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
        <div>
          <p className={styles.bannerTitle}>Couldn't load your housemates</p>
          <p className={styles.bannerText}>{board.error instanceof ApiError ? board.error.message : 'Something went wrong.'}</p>
          <Button variant="ghost" small onClick={() => void board.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  } else if (mates.length === 0) {
    body = (
      <EmptyState
        title="There's nobody to nudge yet"
        caption="When housemates join, you'll find them here."
        action={
          <Button icon={<Copy size={18} strokeWidth={2} aria-hidden="true" />} onClick={() => void copyInvite(houseId)}>
            Copy invite link
          </Button>
        }
      />
    );
  } else {
    body = (
      <ul className={styles.list}>
        {mates.map((member) => (
          <li key={member.id}>
            <NudgeRow member={member} sending={sendingId === member.id} disabled={send.isPending || cooldown > 0} status={status(member)} onPick={choose} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title="Who's being loud?"
      caption={mates.length === 0 && board.isSuccess ? 'Only you are in this house so far.' : "They won't know it was you."}
      icon={
        <span className={styles.chip} aria-hidden="true">
          <BellRing size={20} strokeWidth={2} />
        </span>
      }
    >
      {limited && (
        <div className={styles.banner} role="alert">
          <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
          <div>
            <p className={styles.bannerTitle}>Easy does it</p>
            <p className={styles.bannerText}>You can nudge again in {formatCountdown(cooldown)}.</p>
          </div>
        </div>
      )}
      {failed && (
        <div className={styles.banner} role="alert">
          <CircleAlert size={20} strokeWidth={2} aria-hidden="true" />
          <div>
            <p className={styles.bannerTitle}>Couldn't send that nudge</p>
            <p className={styles.bannerText}>
              {send.error instanceof ApiError && send.error.isNetwork
                ? `${send.error.message} Nothing was sent, so you can try again.`
                : send.error instanceof ApiError
                  ? send.error.message
                  : 'Something went wrong. Nothing was sent.'}
            </p>
          </div>
        </div>
      )}
      {body}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`${confirming?.name ?? 'They'} is resting right now.`}
        lead={confirming && <Avatar name={confirming.name} colorIndex={confirming.colorIndex} resting />}
        description={`Their quiet time runs until ${confirming ? formatMinutes(restingUntilFor(confirming)) : ''}. They won't know it was you. Nudge anyway?`}
      >
        <Button
          variant="nudge"
          block
          icon={<BellRing size={18} strokeWidth={2} aria-hidden="true" />}
          onClick={() => {
            const m = confirming;
            setConfirming(null);
            if (m) pick(m);
          }}
        >
          Nudge anyway
        </Button>
        <Button variant="secondary" block onClick={() => setConfirming(null)}>
          Cancel
        </Button>
      </ConfirmDialog>
      <div className={styles.foot}>
        <Button variant="ghost" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

type RowStatus = { kind: 'away' } | { kind: 'resting'; until: number } | { kind: 'idle'; next: number | null };

/** One housemate: the resting ring and status line, "Not resting", or "away" (not actionable). */
function NudgeRow({
  member,
  status,
  sending,
  disabled,
  onPick,
}: {
  member: BoardMember;
  status: RowStatus;
  sending: boolean;
  disabled: boolean;
  onPick: (member: BoardMember) => void;
}) {
  const away = status.kind === 'away';
  const inactive = away || disabled;
  const caption =
    status.kind === 'away'
      ? 'Another house is active'
      : status.kind === 'resting'
        ? `Resting now · until ${formatMinutes(status.until)}`
        : status.next !== null
          ? `Not resting · quiet time at ${formatMinutes(status.next)}`
          : 'Not resting';
  return (
    <button type="button" className={styles.row} aria-disabled={inactive || undefined} aria-busy={sending || undefined} onClick={() => !inactive && onPick(member)}>
      <Avatar name={member.name} colorIndex={member.colorIndex} resting={status.kind === 'resting'} />
      <span className={styles.nameBlock}>
        <span className={styles.name}>{member.name}</span>
        <span className={styles.cap}>{caption}</span>
      </span>
      {away ? (
        <span className={styles.tagAway}>away</span>
      ) : (
        <span className={styles.tag}>
          {sending ? (
            <>
              <LoaderCircle className={styles.spin} size={14} strokeWidth={2} aria-hidden="true" />
              Sending
            </>
          ) : (
            'Nudge'
          )}
        </span>
      )}
    </button>
  );
}
