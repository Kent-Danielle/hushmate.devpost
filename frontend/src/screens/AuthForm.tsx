import type { InputHTMLAttributes, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../components/Button';
import styles from './AuthForm.module.css';

const LOCKUP_ALT = 'hushmate, Less shush, more hush.';

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={styles.head}>
      <img className={`${styles.logo} ${styles.onDark}`} src="/hushmate-lockup-tagline-dark.svg" width="132" height="44" alt={LOCKUP_ALT} />
      <img className={`${styles.logo} ${styles.onLight}`} src="/hushmate-lockup-tagline-light.svg" width="132" height="44" alt={LOCKUP_ALT} />
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.sub}>{subtitle}</p>
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  hint?: string;
  error?: string | null;
  /** Counter text like "4/30". */
  counter?: string;
  /** Shown as invalid (red border) without its own message. */
  invalid?: boolean;
}

export function Field({ label, id, hint, error, counter, invalid, ...input }: FieldProps) {
  const message = error ?? hint;
  const bad = Boolean(error) || invalid;
  return (
    <div className={`${styles.field} ${bad ? styles.invalid : ''}`}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        id={id}
        className={styles.input}
        aria-invalid={bad || undefined}
        aria-describedby={message ? `${id}-msg` : undefined}
      />
      {(message || counter) && (
        <div className={styles.msg} id={`${id}-msg`}>
          {error && <AlertCircle size={16} aria-hidden="true" />}
          <span>{message}</span>
          {counter && <span className={styles.counter}>{counter}</span>}
        </div>
      )}
    </div>
  );
}

export type FormProblem = { kind: 'banner'; title: string; text: string } | { kind: 'network' } | null;

export function ProblemBanner({ problem, onRetry }: { problem: FormProblem; onRetry: () => void }) {
  if (!problem) return null;
  if (problem.kind === 'network') {
    return (
      <div className={`${styles.banner} ${styles.net}`} role="status">
        <span className={styles.bannerTitle}>Can't reach Hushmate right now.</span>
        <Button variant="ghost" small onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className={`${styles.banner} ${styles.error}`} role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <span className={styles.bannerTitle}>{problem.title}</span>
        <p>{problem.text}</p>
      </div>
    </div>
  );
}

export function FormShell({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  return (
    <main className={styles.screen}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
      </form>
    </main>
  );
}

export { styles as authStyles };
