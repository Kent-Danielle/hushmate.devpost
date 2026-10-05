import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../../auth/AuthContext';
import { welcomeParts } from '../../lib/copy';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import styles from './DemoWelcomeCard.module.css';

const SEEN_KEY = 'hushmate-demo-welcome-seen';

function wasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage unavailable: the card may show again on this device, nothing worse
  }
}

/**
 * Shown once after each demo sign-in on this device (the flag is a `hushmate-*` key, so sign-out clears it).
 * Renders nothing for non-demo accounts or until GET /me has carried the `demo` block.
 */
export function DemoWelcomeCard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(() => !wasSeen());
  const demo = user?.isDemo ? user.demo : undefined;
  if (!demo || !open) return null;

  const p = welcomeParts(demo.botNames, demo.houseName);
  function close() {
    markSeen();
    setOpen(false);
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <div className={styles.center}>
          <Dialog.Content className={styles.card}>
            <div className={styles.avatars} aria-hidden="true">
              {demo.botNames.map((name, i) => (
                <Avatar key={name} name={name} colorIndex={i} size="lg" />
              ))}
            </div>
            <Dialog.Title className={styles.title}>{p.title}</Dialog.Title>
            <Dialog.Description asChild>
              <div className={styles.text}>
                <p className={styles.intro}>
                  <b>{p.names}</b>
                  {p.intro}
                </p>
                <p>
                  {p.before}
                  <b>{p.emphasis}</b>
                  {p.after}
                </p>
              </div>
            </Dialog.Description>
            <Button block onClick={close}>
              Show me around
            </Button>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
