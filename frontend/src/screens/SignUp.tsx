import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { setToken } from '../api/session';
import { useSignUp } from '../api/hooks/auth';
import { useAuth } from '../auth/AuthContext';
import { destinationAfterAuth } from '../auth/destination';
import { Button, ButtonLink } from '../components/Button';
import { AuthHeader, authStyles, Field, FormShell, ProblemBanner, type FormProblem } from './AuthForm';

type Errors = { name?: string; email?: string; password?: string };

const NAME_MAX = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rules as the server (name 1-30, email, password 8-128).
function validate(name: string, email: string, password: string): Errors {
  const errors: Errors = {};
  if (name.trim().length < 1) errors.name = 'Add the name your housemates will see.';
  else if (name.trim().length > NAME_MAX) errors.name = 'Use 30 characters or fewer.';
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (password.length > 128) errors.password = 'Use 128 characters or fewer.';
  return errors;
}

/** Maps the API's validation messages (strings like "password must be longer…") onto their field. */
function mapServerMessages(messages: string[]): { errors: Errors; rest: string[] } {
  const errors: Errors = {};
  const rest: string[] = [];
  for (const message of messages) {
    const lower = message.toLowerCase();
    const field = (['name', 'email', 'password'] as const).find((f) => lower.startsWith(f) || lower.includes(` ${f} `));
    if (field && !errors[field]) errors[field] = message.charAt(0).toUpperCase() + message.slice(1);
    else rest.push(message);
  }
  return { errors, rest };
}

export default function SignUp() {
  const queryClient = useQueryClient();
  const { signIn } = useAuth();
  const mutation = useSignUp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<FormProblem>(null);
  const [working, setWorking] = useState(false);

  async function submit() {
    if (working) return;
    const found = validate(name, email, password);
    setErrors(found);
    setProblem(null);
    if (Object.keys(found).length > 0) return;

    setWorking(true);
    try {
      const response = await mutation.mutateAsync({ name: name.trim(), email: email.trim(), password });
      setToken(response.token);
      const destination = await destinationAfterAuth(queryClient);
      signIn(response, destination);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: 'That email already has an account. Try signing in instead.' });
      } else if (err instanceof ApiError && err.status === 400) {
        const { errors: mapped, rest } = mapServerMessages(err.messages);
        setErrors(mapped);
        if (rest.length > 0) setProblem({ kind: 'banner', title: "Couldn't create your account", text: rest.join(' ') });
      } else if (err instanceof ApiError && err.status === 429) {
        setProblem({ kind: 'banner', title: 'Too many tries', text: 'Give it a minute, then try again.' });
      } else if (err instanceof ApiError && err.isNetwork) {
        setProblem({ kind: 'network' });
      } else {
        setProblem({ kind: 'banner', title: "Couldn't create your account", text: 'Something went wrong. Try again in a moment.' });
      }
      setWorking(false);
    }
  }

  return (
    <FormShell onSubmit={() => void submit()}>
      <AuthHeader title="Create your account" subtitle="Then make a house or join one." />
      <ProblemBanner problem={problem} onRetry={() => void submit()} />
      <div className={authStyles.fields}>
        <Field
          label="Your name"
          id="name"
          autoComplete="name"
          maxLength={NAME_MAX}
          placeholder="What should your housemates call you?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          hint="Housemates only ever see your name."
          counter={`${name.length}/${NAME_MAX}`}
        />
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
          error={errors.email}
          hint="Only you see your email. Housemates never do."
        />
        <Field
          label="Password"
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="8 to 128 characters."
        />
      </div>
      <div className={authStyles.actions}>
        <Button type="submit" block busy={working}>
          {working ? 'Creating…' : 'Sign up'}
        </Button>
        <div className={authStyles.switch}>
          <span>Already have an account?</span>
          <ButtonLink to="/signin" variant="ghost" small>
            Sign in
          </ButtonLink>
        </div>
      </div>
    </FormShell>
  );
}
