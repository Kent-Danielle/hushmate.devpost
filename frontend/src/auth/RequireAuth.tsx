import { useCallback, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { usePushSync, useServiceWorkerMessages } from '../api/hooks/push';
import { setReturnTo } from '../api/session';
import { useAuth } from './AuthContext';

/** Signed-in app-wide work: re-send the push subscription on load, and react to service worker messages. */
function SignedIn() {
  const navigate = useNavigate();
  const go = useCallback((path: string) => navigate(path), [navigate]);
  usePushSync();
  useServiceWorkerMessages(go);
  return <Outlet />;
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
