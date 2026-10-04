import { Clock } from 'lucide-react';
import { formatCountdown } from '../../api/hooks/nudges';
import styles from './CooldownPill.module.css';

/** "Nudge again in 4:32". It takes the place of the Nudge button while the 5-minute cooldown runs. Plain text, not a live region, so it doesn't chatter. */
export function CooldownPill({ seconds }: { seconds: number }) {
  return (
    <span className={styles.pill}>
      <Clock size={18} strokeWidth={2} aria-hidden="true" />
      Nudge again in {formatCountdown(seconds)}
    </span>
  );
}
