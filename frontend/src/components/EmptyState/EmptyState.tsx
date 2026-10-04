import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** The app's voice: Fredoka. */
  title: string;
  caption?: ReactNode;
  /** One button, if any. */
  action?: ReactNode;
}

export function EmptyState({ title, caption, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <p className={styles.voice}>{title}</p>
      {caption && <p className={styles.caption}>{caption}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
