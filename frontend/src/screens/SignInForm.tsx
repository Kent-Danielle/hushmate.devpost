import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { setToken } from '../api/session';
import { useSignIn } from '../api/hooks/auth';
import { useAuth } from '../auth/AuthContext';
import { destinationAfterAuth } from '../auth/destination';
import { Button } from '../components/Button';
import { AuthHeader, authStyles, Field, FormShell, ProblemBanner, type FormProblem } from './AuthForm';

interface SignInFormProps {
  title: string;
  subtitle: string;
  initialEmail?: string;
  initialPassword?: string;
  /** Shown under the header (e.g. the demo's info note). */
  note?: ReactNode;
  /** Shown under the Sign in button. */
  footer?: ReactNode;
  /** Called with the destination right after sign-in. `/signin` leaves this out because PublicOnly sends the person on; routes outside PublicOnly (`/demo`) navigate here. */
  onSignedIn?: (destination: string) => void;
}

/** The sign-in form and flow shared by `/signin` and `/demo`: same validation, same errors, same destination after sign-in. */
export default function SignInForm({ title, subtitle, initialEmail = '', initialPassword = '', note, footer, onSignedIn }: SignInFormProps) {
  const queryClient = useQueryClient();
  const { signIn } = useAuth();
  const mutation = useSignIn();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [badCredentials, setBadCredentials] = useState(false);
  const [problem, setProblem] = useState<FormProblem>(null);
  const [working, setWorking] = useState(false);

  async function submit() {
    if (working) return;
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = 'Enter your email.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    setBadCredentials(false);
    setProblem(null);
    if (errors.email || errors.password) return;

    setWorking(true);
    try {
      const response = await mutation.mutateAsync({ email: email.trim(), password });
      setToken(response.token); // the destination lookup below is an authenticated request
      const destination = await destinationAfterAuth(queryClient);
      signIn(response, destination);
      onSignedIn?.(destination);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setBadCredentials(true);
      else if (err instanceof ApiError && err.status === 429) setProblem({ kind: 'banner', title: 'Too many tries', text: 'Give it a minute, then try again.' });
      else if (err instanceof ApiError && err.isNetwork) setProblem({ kind: 'network' });
      else setProblem({ kind: 'banner', title: "Couldn't sign you in", text: 'Something went wrong. Try again in a moment.' });
      setWorking(false);
    }
  }

  return (
    <FormShell onSubmit={() => void submit()}>
      <AuthHeader title={title} subtitle={subtitle} />
      {note}
      {badCredentials && <ProblemBanner problem={{ kind: 'banner', title: "Couldn't sign you in", text: 'Check your email and password and try again.' }} onRetry={() => void submit()} />}
      <ProblemBanner problem={problem} onRetry={() => void submit()} />
      <div className={authStyles.fields}>
        <Field
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          invalid={badCredentials}
        />
        <Field
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password ?? (badCredentials ? "That email and password don't match." : null)}
        />
      </div>
      <div className={authStyles.actions}>
        <Button type="submit" block busy={working}>
          {working ? 'Signing in…' : 'Sign in'}
        </Button>
        {footer}
      </div>
    </FormShell>
  );
}
