import { useCallback, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useAcknowledge, usePendingNudges } from '../api/hooks/nudges';
import { usePushSync, useServiceWorkerMessages } from '../api/hooks/push';
import { setReturnTo } from '../api/session';
import { NudgeOverlay } from '../components/NudgeOverlay';
import { useAuth } from './AuthContext';

/** Checks GET /nudges/pending on load and every refocus (and when the service worker reports a push); shows the overlay above everything. */
function NudgeOverlayHost() {
  const pending = usePendingNudges();
  const acknowledge = useAcknowledge();
  return (
    <NudgeOverlay
      nudges={pending.data ?? []}
      onGotIt={() => acknowledge.mutate()}
      busy={acknowledge.isPending}
      failed={acknowledge.isError}
    />
  );
}

/** Signed-in app-wide work: re-send the push subscription on load, and react to service worker messages. */
function SignedIn() {
  const navigate = useNavigate();
  const go = useCallback((path: string) => navigate(path), [navigate]);
  usePushSync();
  useServiceWorkerMessages(go);
  return (
    <>
      <Outlet />
      <NudgeOverlayHost />
    </>
  );
}

/** No token: go to /signin and remember the requested path (unless the person just signed out on purpose). */
export default function RequireAuth() {
  const { token, signedOutByUser, postAuthPath, clearPostAuthPath } = useAuth();
  const location = useLocation();
  const remember = token === null && !signedOutByUser;
  const requested = location.pathname + location.search;

  useEffect(() => {
    if (remember) setReturnTo(requested);
  }, [remember, requested]);

  // Arrived inside the app: the post-sign-in destination has been used.
  useEffect(() => {
    if (token !== null && postAuthPath !== null) clearPostAuthPath();
  }, [token, postAuthPath, clearPostAuthPath]);

  if (token === null) return <Navigate to="/signin" replace />;
  return <SignedIn />;
}
