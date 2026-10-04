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
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { useCopyInvite } from '../houses/useCopyInvite';
import styles from './NudgeSheet.module.css';

interface NudgeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  houseId: string;
}

/**
 * "Who's being loud?": the housemates of the active house, except you. Picking one sends the nudge at once.
 * Slice 5 adds, per row, the resting status + confirm dialog, "Not resting" and "away" through `rowStatus` below.
 */
export function NudgeSheet({ open, onOpenChange, houseId }: NudgeSheetProps) {
  const { user } = useAuth();
  const toast = useToast();
  const copyInvite = useCopyInvite();
  const board = useBoard(houseId, open);
  const send = useSendNudge();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const cooldown = useCountdown(user?.nudgeCooldownUntil);

  const mates = (board.data?.members ?? []).filter((m) => !m.isYou);
  const limited = send.isError && cooldownFromError(send.error) !== null && cooldown > 0;
  const failed = send.isError && !limited;

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
            <NudgeRow member={member} sending={sendingId === member.id} disabled={send.isPending || cooldown > 0} onPick={pick} />
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
      <div className={styles.foot}>
        <Button variant="ghost" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

/** One housemate. Slice 5 slots the resting ring, the status line ("Resting now · until 4:30 AM", "Not resting") and "away" in here. */
function NudgeRow({
  member,
  sending,
  disabled,
  onPick,
}: {
  member: BoardMember;
  sending: boolean;
  disabled: boolean;
  onPick: (member: BoardMember) => void;
}) {
  return (
    <button type="button" className={styles.row} aria-disabled={disabled || undefined} aria-busy={sending || undefined} onClick={() => !disabled && onPick(member)}>
      <Avatar name={member.name} colorIndex={member.colorIndex} />
      <span className={styles.name}>{member.name}</span>
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
    </button>
  );
}
