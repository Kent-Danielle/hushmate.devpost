import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthContext';

/** Landing, sign-up and sign-in send a signed-in person on: to where sign-in decided, or to the app's home tab. */
export default function PublicOnly() {
  const { token, postAuthPath } = useAuth();
  if (token !== null) return <Navigate to={postAuthPath ?? '/schedule'} replace />;
  return <Outlet />;
}
