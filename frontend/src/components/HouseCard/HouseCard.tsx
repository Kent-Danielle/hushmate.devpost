import { Copy } from 'lucide-react';
import type { HouseListItem } from '../../api/types';
import { Button } from '../Button';
import styles from './HouseCard.module.css';

interface HouseCardProps {
  item: HouseListItem;
  /** Demo accounts: every house-changing control is hidden, not disabled. */
  locked?: boolean;
  busy?: boolean;
  onMakeActive: () => void;
  onCopyInvite: () => void;
  onDismiss: () => void;
}

/** Active (lavender border and badge), Inactive (Make active), Pending (dashed) or Declined (dismissible). */
export function HouseCard({ item, locked, busy, onMakeActive, onCopyInvite, onDismiss }: HouseCardProps) {
  const { house, status, isActive } = item;
  const kind = status === 'approved' ? (isActive ? 'active' : 'inactive') : status;
  const idText = `${house.name}#${house.code}`;

  return (
    <li className={`${styles.card} ${styles[kind]}`}>
      <div className={styles.top}>
        <div className={styles.names}>
          <h2 className={styles.name}>{house.name}</h2>
          <p className={styles.id}>{idText}</p>
        </div>
        {kind === 'active' && <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>}
        {kind === 'pending' && <span className={`${styles.badge} ${styles.badgePending}`}>Pending approval</span>}
        {kind === 'declined' && <span className={`${styles.badge} ${styles.badgeDeclined}`}>Declined</span>}
      </div>

      {kind === 'pending' && <p className={styles.caption}>The owner needs to say yes.</p>}

      {kind === 'declined' && (
        <div className={styles.row}>
          <p className={styles.caption}>{house.name} didn't accept this request.</p>
          {!locked && (
            <Button variant="ghost" small busy={busy} onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      )}

      {(kind === 'active' || kind === 'inactive') && !locked && (
        <div className={styles.row}>
          {kind === 'inactive' ? (
            <Button variant="ghost" small busy={busy} onClick={onMakeActive}>
              Make active
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" small icon={<Copy size={18} strokeWidth={2} aria-hidden="true" />} onClick={onCopyInvite}>
            Copy invite link
          </Button>
        </div>
      )}
    </li>
  );
}
