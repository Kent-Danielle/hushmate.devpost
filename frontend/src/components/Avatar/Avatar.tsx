import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  /** 0-4 maps to --hm-mate-1..5. `null` is treated as 0. */
  colorIndex?: number | null;
  /** "you" is lavender. */
  you?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** The 4s breathing ring: resting now. */
  resting?: boolean;
}

/** An initial on the person's pastel. Decorative: the name is always written next to it. */
export function Avatar({ name, colorIndex, you, size = 'md', resting }: AvatarProps) {
  const mate = Math.min(4, Math.max(0, colorIndex ?? 0));
  const initial = (Array.from(name.trim())[0] ?? '?').toUpperCase();
  const cls = [styles.avatar, styles[size], you ? styles.you : styles[`m${mate}`], resting && styles.resting].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-hidden="true">
      {initial}
    </span>
  );
}
