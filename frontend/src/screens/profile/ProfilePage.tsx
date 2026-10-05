import { useState } from 'react';
import { LogOut, SunMoon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { DEMO_SIGN_OUT_NOTE } from '../../lib/copy';
import { NotificationSetup } from '../../components/NotificationSetup';
import { useToast } from '../../components/Toast';
import { applyTheme, readTheme, type ThemeChoice } from './theme';
import styles from './ProfilePage.module.css';

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'device', label: 'Device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfilePage() {
  const { user, isLoadingUser, userError, refetchUser, signOut } = useAuth();
  const toast = useToast();
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [signingOut, setSigningOut] = useState(false);

  function chooseTheme(choice: ThemeChoice) {
    setTheme(choice);
    applyTheme(choice);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut(); // never throws; RequireAuth then sends the person to /signin
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Profile</h1>

      {isLoadingUser ? (
        <div className={styles.skel} role="status" aria-label="Loading your profile" />
      ) : user ? (
        <section className={`${styles.card} ${styles.who}`} aria-label="You">
          <div className={styles.avatar} aria-hidden="true">
            {user.name.trim().charAt(0).toUpperCase()}
          </div>
          <div className={styles.whoText}>
            <b className={styles.name}>{user.name}</b>
            <span className={styles.email}>{user.email}</span>
          </div>
        </section>
      ) : (
        <section className={`${styles.card} ${styles.problem}`} role="alert">
          <p>{userError?.isNetwork ? "Can't reach Hushmate right now." : "Couldn't load your profile."}</p>
          <Button variant="secondary" small onClick={refetchUser}>
            Try again
          </Button>
        </section>
      )}

      <NotificationSetup compact onEnabled={() => toast.show('Notifications are on.')} />

      <section className={styles.card} aria-label="Theme">
        <div className={styles.row}>
          <SunMoon className={styles.rowIcon} size={24} aria-hidden="true" />
          <b className={styles.rowTitle}>Theme</b>
        </div>
        <div className={styles.seg} role="group" aria-label="Theme">
          {THEMES.map(({ value, label }) => (
            <button key={value} type="button" aria-pressed={theme === value} onClick={() => chooseTheme(value)}>
              {label}
            </button>
          ))}
        </div>
        <p className={styles.caption}>Device follows your phone's light or dark setting. Saved on this device only.</p>
      </section>

      <Button variant="secondary" block busy={signingOut} icon={<LogOut size={24} aria-hidden="true" />} onClick={() => void handleSignOut()}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
      {user?.isDemo && <p className={styles.caption}>{DEMO_SIGN_OUT_NOTE}</p>}
    </div>
  );
}
