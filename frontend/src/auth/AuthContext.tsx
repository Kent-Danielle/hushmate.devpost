import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setUnauthorizedHandler, type ApiError } from '../api/client';
import { useMe, ME_KEY } from '../api/hooks/me';
import { clearLocalKeys, clearToken, getToken, setToken } from '../api/session';
import type { AuthResponse, User } from '../api/types';
import { unregisterPush } from '../push/register';

interface AuthValue {
  token: string | null;
  user: User | undefined;
  isLoadingUser: boolean;
  userError: ApiError | null;
  refetchUser: () => void;
  /** true after the person chose Sign out, so RequireAuth doesn't remember the page as a return-to. */
  signedOutByUser: boolean;
  /** Where PublicOnly sends the person right after sign-up or sign-in. */
  postAuthPath: string | null;
  clearPostAuthPath: () => void;
  signIn: (response: AuthResponse, destination: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [signedOutByUser, setSignedOutByUser] = useState(false);
  const [postAuthPath, setPostAuthPath] = useState<string | null>(null);
  const signingOut = useRef(false);
  const me = useMe(token !== null);

  const finishSignOut = useCallback(
    async (server: boolean) => {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        await unregisterPush({ server }); // 1. push subscription (needs the token)
        clearToken(); // 2. token
        clearLocalKeys(); // 4. local keys (before the state flips, so RequireAuth's return-to survives)
        setTokenState(null);
        setPostAuthPath(null);
        queryClient.clear(); // 3. cached data
      } finally {
        signingOut.current = false;
      }
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    setSignedOutByUser(true);
    await finishSignOut(true);
  }, [finishSignOut]);

  // A 401 from any signed-in route: sign out locally. RequireAuth then sends the person to /signin with return-to.
  useEffect(() => {
    setUnauthorizedHandler(() => void finishSignOut(false));
    return () => setUnauthorizedHandler(null);
  }, [finishSignOut]);

  const signIn = useCallback(
    ({ token: next, user }: AuthResponse, destination: string) => {
      setToken(next);
      setPostAuthPath(destination);
      queryClient.setQueryData(ME_KEY, user);
      setSignedOutByUser(false);
      setTokenState(next);
    },
    [queryClient],
  );

  const clearPost = useCallback(() => setPostAuthPath(null), []);

  const value = useMemo<AuthValue>(
    () => ({
      token,
      user: token ? me.data : undefined,
      isLoadingUser: token !== null && me.isPending,
      userError: token !== null ? ((me.error as ApiError | null) ?? null) : null,
      refetchUser: () => void me.refetch(),
      signedOutByUser,
      postAuthPath,
      clearPostAuthPath: clearPost,
      signIn,
      signOut,
    }),
    [token, me.data, me.isPending, me.error, me.refetch, signedOutByUser, postAuthPath, clearPost, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
