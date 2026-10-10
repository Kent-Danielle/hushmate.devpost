import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../api/client';
import { assignDemoAccount } from '../api/hooks/auth';
import { getDemoAccount, setDemoAccount } from '../api/session';
import { useAuth } from '../auth/AuthContext';
import { Button, ButtonLink } from '../components/Button';
import { DEMO_ASSIGN_PROBLEMS, DEMO_SIGN_IN } from '../lib/copy';
import { AuthHeader, authStyles, InfoNote, ProblemBanner, type FormProblem } from './AuthForm';
import SignInForm from './SignInForm';

interface Assigned {
  email: string;
  password: string;
}

function problemFor(err: unknown): FormProblem {
  if (err instanceof ApiError) {
    if (err.isNetwork) return { kind: 'network' };
    if (err.status === 429) return { kind: 'banner', ...DEMO_ASSIGN_PROBLEMS.busy };
    if (err.status === 503) return { kind: 'banner', ...DEMO_ASSIGN_PROBLEMS.unavailable };
  }
  return { kind: 'banner', ...DEMO_ASSIGN_PROBLEMS.other };
}

function Note() {
  return (
    <InfoNote>
      {DEMO_SIGN_IN.before}
      <b>{DEMO_SIGN_IN.emphasis}</b>
      {DEMO_SIGN_IN.after}
    </InfoNote>
  );
}

function BackToHome() {
  return (
    <ButtonLink to="/" variant="secondary" block>
      Back to home
    </ButtonLink>
  );
}

/**
 * /demo (public, outside PublicOnly so a signed-in visitor isn't redirected away).
 * Signs out any current account first, then asks the backend for a demo account and shows the sign-in form prefilled.
 */
export default function DemoSignIn() {
  const navigate = useNavigate();
  const { token, signOut } = useAuth();
  // Whoever is signed in when this screen opens gets signed out. Someone who signs in *from* this screen must not be.
  const [startedSignedIn] = useState(() => token !== null);
  const signOutStarted = useRef(false);
  const assignInFlight = useRef(false);
  const [assigned, setAssigned] = useState<Assigned | null>(null);
  const [problem, setProblem] = useState<FormProblem>(null);

  const assign = useCallback(async () => {
    if (assignInFlight.current) return;
    assignInFlight.current = true;
    setProblem(null);
    try {
      const preferredEmail = getDemoAccount();
      const account = await assignDemoAccount(preferredEmail ? { preferredEmail } : {});
      setDemoAccount(account.email);
      setAssigned(account);
    } catch (err) {
      setProblem(problemFor(err));
      assignInFlight.current = false; // a retry may go again
    }
  }, []);

  // 1. Signed in on arrival: the normal sign-out (push unregistered, token, cache and local keys cleared). The ref also covers StrictMode's second effect run.
  useEffect(() => {
    if (startedSignedIn && token !== null && !signOutStarted.current) {
      signOutStarted.current = true;
      void signOut();
    }
  }, [startedSignedIn, token, signOut]);

  // 2. Only once the signed-out state has landed (token null), ask for the account. `assignInFlight` stops a second run (StrictMode) from asking twice.
  useEffect(() => {
    if (token === null && assigned === null) void assign();
  }, [token, assigned, assign]);

  if (assigned) {
    return (
      <SignInForm
        title={DEMO_SIGN_IN.title}
        subtitle={DEMO_SIGN_IN.subtitle}
        initialEmail={assigned.email}
        initialPassword={assigned.password}
        note={<Note />}
        footer={<BackToHome />}
        onSignedIn={(destination) => navigate(destination, { replace: true })}
      />
    );
  }

  return (
    <main className={authStyles.screen}>
      <div className={authStyles.form}>
        <AuthHeader title={DEMO_SIGN_IN.title} subtitle={DEMO_SIGN_IN.subtitle} />
        <Note />
        <ProblemBanner problem={problem} onRetry={() => void assign()} />
        {problem === null && (
          <div className={authStyles.fields} aria-hidden="true">
            <div className={authStyles.skeleton} />
            <div className={authStyles.skeleton} />
          </div>
        )}
        <div className={authStyles.actions}>
          {problem === null ? (
            <Button block busy>
              Getting the demo ready…
            </Button>
          ) : (
            problem.kind === 'banner' && (
              <Button block onClick={() => void assign()}>
                Try again
              </Button>
            )
          )}
          <BackToHome />
        </div>
      </div>
    </main>
  );
}
