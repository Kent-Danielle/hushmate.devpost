import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { LoaderCircle } from 'lucide-react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'nudge' | 'ack' | 'secondary' | 'ghost';

interface Look {
  variant?: ButtonVariant;
  block?: boolean;
  small?: boolean;
  danger?: boolean;
}

export function buttonClass({ variant = 'primary', block, small, danger }: Look, extra?: string): string {
  return [styles.btn, styles[variant], block && styles.block, small && styles.small, danger && styles.danger, extra]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends Look, ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows a quiet spinner and ignores presses. Stays focusable (aria-disabled, not disabled). */
  busy?: boolean;
  icon?: ReactNode;
}

export function Button({ variant, block, small, danger, busy, icon, disabled, className, onClick, type = 'button', children, ...rest }: ButtonProps) {
  const inactive = busy || disabled;
  return (
    <button
      {...rest}
      type={type}
      className={buttonClass({ variant, block, small, danger }, [busy && styles.busy, className].filter(Boolean).join(' '))}
      aria-disabled={inactive || undefined}
      onClick={(event) => {
        if (inactive) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {busy ? <LoaderCircle className={styles.spin} size={18} strokeWidth={2} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, block, small, danger, className, ...rest }: Look & LinkProps) {
  return <Link {...rest} className={buttonClass({ variant, block, small, danger }, className)} />;
}
