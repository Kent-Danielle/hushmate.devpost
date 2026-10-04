import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import styles from './Sheet.module.css';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Optional leading header element, e.g. the nudge sheet's icon chip. */
  icon?: ReactNode;
  /** Optional line directly under the title; also the dialog's description. */
  caption?: string;
  children: ReactNode;
}

/** A bottom sheet built on Radix Dialog: focus trap, Escape and scrim tap close it, focus returns to the opener. */
export function Sheet({ open, onOpenChange, title, icon, caption, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content className={styles.sheet} {...(caption ? {} : { 'aria-describedby': undefined })}>
          <div className={styles.handle} aria-hidden="true" />
          <div className={styles.head}>
            {icon}
            {caption ? (
              <div className={styles.titles}>
                <Dialog.Title className={styles.titleText}>{title}</Dialog.Title>
                <Dialog.Description className={styles.caption}>{caption}</Dialog.Description>
              </div>
            ) : (
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            )}
            <Dialog.Close className={styles.close} aria-label="Close">
              <X size={24} strokeWidth={2} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
