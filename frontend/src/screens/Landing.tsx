import { Link } from 'react-router';
import styles from './Landing.module.css';

const LOCKUP_ALT = 'hushmate, Less shush, more hush.';

export default function Landing() {
  return (
    <main className={styles.screen}>
      <div className={styles.hero}>
        <div className={styles.brand}>
          <img className={`${styles.lockup} ${styles.onDark}`} src="/hushmate-lockup-tagline-dark.svg" width="220" height="73" alt={LOCKUP_ALT} />
          <img className={`${styles.lockup} ${styles.onLight}`} src="/hushmate-lockup-tagline-light.svg" width="220" height="73" alt={LOCKUP_ALT} />
          <div className={styles.avatars} aria-hidden="true">
            <span className={`${styles.avatar} ${styles.m1} ${styles.resting}`}>M</span>
            <span className={`${styles.avatar} ${styles.m2}`}>J</span>
            <span className={`${styles.avatar} ${styles.m3}`}>P</span>
            <span className={`${styles.avatar} ${styles.you}`}>A</span>
          </div>
        </div>
        <p className={styles.pitch}>
          Share your quiet times with your housemates. When it gets loud, nudge them gently. They'll never know it was you.
        </p>
      </div>
      <div className={styles.actions}>
        <Link to="/signup" className={`${styles.btn} ${styles.primary}`}>Sign up</Link>
        <Link to="/signin" className={`${styles.btn} ${styles.secondary}`}>Sign in</Link>
        <p className={styles.note}>Works right in your browser. Nothing to install.</p>
      </div>
    </main>
  );
}
