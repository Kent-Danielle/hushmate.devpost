import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, CircleAlert } from 'lucide-react';
import type { PendingNudge } from '../../api/types';
import { Button } from '../Button';
import styles from './NudgeOverlay.module.css';

interface NudgeOverlayProps {
  /** Everything pending. The overlay is open while this is non-empty. */
  nudges: PendingNudge[];
  onGotIt: () => void;
  busy?: boolean;
  /** Set when acknowledging failed; the card stays so the person can try again. */
  failed?: boolean;
}

/**
 * A scrim and a card above everything. No close button, and neither Escape nor a scrim tap dismisses it:
 * it has to be acknowledged. One overlay covers all pending nudges, and the sender is never named.
 */
export function NudgeOverlay({ nudges, onGotIt, busy, failed }: NudgeOverlayProps) {
  // Keep the last non-empty list so the card's words stay put while it fades out.
  const [shown, setShown] = useState(nudges);
  if (nudges.length > 0 && nudges !== shown) setShown(nudges);

  return (
    <Dialog.Root open={nudges.length > 0}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <div className={styles.center}>
          <Dialog.Content
            className={styles.card}
            role="alertdialog"
            aria-label="A nudge from your house"
            aria-describedby={undefined}
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => {
              // Land on Got it: it is the only thing to do here.
              event.preventDefault();
              (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-got-it]')?.focus();
            }}
          >
            <Dialog.Title className={styles.srOnly}>A nudge from your house</Dialog.Title>
            <img className={styles.icon} src="/icon-192.png" alt="" width={56} height={56} />
            <div className={styles.messages}>
              {shown.map((nudge) => (
                <div key={nudge.id} className={styles.message}>
                  <p className={styles.voice}>{nudge.message}</p>
                  {nudge.subtitle && <p className={styles.subtitle}>{nudge.subtitle}</p>}
                </div>
              ))}
            </div>
            {failed && (
              <p className={styles.error} role="alert">
                <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />
                Couldn't say Got it just now. Try again.
              </p>
            )}
            <Button variant="ack" block busy={busy} onClick={onGotIt} data-got-it="" icon={<Check size={20} strokeWidth={2} aria-hidden="true" />}>
              Got it
            </Button>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
