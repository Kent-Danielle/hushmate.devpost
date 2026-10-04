import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Spoken in the app's voice (Fredoka). */
  title: string;
  description?: ReactNode;
  /** Optional leading element, e.g. an Avatar. */
  lead?: ReactNode;
  /** The buttons, stacked full width. Put Cancel last. */
  children: ReactNode;
}

/** A centred alert dialog over a scrim (Radix Dialog as an alertdialog): focus trap, Escape and scrim close it, focus returns. */
export function ConfirmDialog({ open, onOpenChange, title, description, lead, children }: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <div className={styles.center}>
          <Dialog.Content className={styles.dialog} role="alertdialog" {...(description ? {} : { 'aria-describedby': undefined })}>
            <div className={styles.head}>
              {lead}
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            </div>
            {description && <Dialog.Description className={styles.text}>{description}</Dialog.Description>}
            <div className={styles.actions}>{children}</div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
