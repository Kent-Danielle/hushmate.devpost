import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Bell, Check } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useVapidKey } from '../../api/hooks/push';
import { iosSteps, needsHomeScreen } from '../../push/ios';
import { enablePush, pushSupported, PermissionNotGranted } from '../../push/register';
import { Button } from '../Button';
import styles from './NotificationSetup.module.css';

type View = 'ios-install' | 'unsupported' | 'denied' | 'default' | 'granted';

// Order matters (spec: Frontend: Push setup). iPhone in a Safari tab is checked first: there `PushManager`
// doesn't exist, so the generic "unsupported" check would hide the Home Screen steps it needs.
function readView(): View {
  if (needsHomeScreen()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  const permission = Notification.permission;
  return permission === 'default' ? 'default' : permission;
}

interface Props {
  /** The Profile card (title row and On/Off badge). Without it, only the body shows (for setup screens). */
  compact?: boolean;
  /** Called after notifications were turned on from this component. */
  onEnabled?: () => void;
}

export default function NotificationSetup({ compact = false, onEnabled }: Props) {
  const [view, setView] = useState<View>(readView);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vapid = useVapidKey(view === 'default');

  // Prefetch the service worker registration so the tap handler has nothing to wait for.
  useEffect(() => {
    if (view !== 'default') return;
    let cancelled = false;
    void navigator.serviceWorker.ready.then((reg) => {
      if (!cancelled) setRegistration(reg);
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  // The person may change the permission in Settings and come back.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setView(readView());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const ready = registration !== null && vapid.data !== undefined;

  function turnOn() {
    if (!registration || !vapid.data) return;
    setError(null);
    setBusy(true);
    enablePush(registration, vapid.data)
      .then(() => {
        setView('granted');
        onEnabled?.();
      })
      .catch((err: unknown) => {
        if (err instanceof PermissionNotGranted) {
          setView(readView()); // denied, or dismissed (still "default")
        } else if (err instanceof ApiError) {
          setError("Couldn't save this device. Try again.");
        } else {
          setError("Couldn't turn notifications on here. Try again.");
        }
      })
      .finally(() => setBusy(false));
  }

  let badge: { label: string; on: boolean };
  let body: ReactNode;
  switch (view) {
    case 'granted':
      badge = { label: 'On', on: true };
      body = <p className={styles.text}>Nudges will arrive on this device.</p>;
      break;
    case 'denied':
      badge = { label: 'Blocked', on: false };
      body = <p className={styles.text}>Turn notifications on in Settings → Notifications → Hushmate.</p>;
      break;
    case 'unsupported':
      badge = { label: 'Not available', on: false };
      body = <p className={styles.text}>This browser can't show notifications. Everything else works, and nudges show up when you open Hushmate.</p>;
      break;
    case 'ios-install':
      badge = { label: 'Off', on: false };
      body = (
        <>
          <p className={styles.text}>On iPhone, add Hushmate to your Home Screen first.</p>
          <ol className={styles.steps}>
            {iosSteps(compact ? 'Then turn notifications on here.' : 'Then come back to turn notifications on.').map((step) => (
              <li key={step}>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </>
      );
      break;
    default:
      badge = { label: 'Off', on: false };
      body = (
        <>
          <p className={styles.text}>
            Get nudges and join approvals as notifications. Without them, a nudge waits and shows up when you open Hushmate.
          </p>
          {(error || vapid.isError) && (
            <p className={styles.error} role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error ?? "Couldn't get ready for notifications. Check your connection and try again."}</span>
            </p>
          )}
          <Button block busy={busy} disabled={!ready && !vapid.isError} icon={<Bell size={24} aria-hidden="true" />} onClick={vapid.isError ? () => void vapid.refetch() : turnOn}>
            {vapid.isError ? 'Try again' : 'Turn on notifications'}
          </Button>
        </>
      );
  }

  if (!compact) return <div className={styles.bare}>{body}</div>;

  return (
    <section className={styles.card} aria-label="Notifications">
      <div className={styles.head}>
        {view !== 'denied' && view !== 'unsupported' && view !== 'ios-install' && <Bell className={styles.headIcon} size={24} aria-hidden="true" />}
        <b className={styles.title}>Notifications</b>
        <span className={`${styles.badge} ${badge.on ? styles.on : styles.off}`}>
          {badge.on && <Check size={16} aria-hidden="true" />}
          {badge.label}
        </span>
      </div>
      {body}
    </section>
  );
}
