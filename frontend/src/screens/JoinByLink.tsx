import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { House } from 'lucide-react';
import { ApiError } from '../api/client';
import { useInvite, useJoinByInvite } from '../api/hooks/houses';
import { setReturnTo } from '../api/session';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { authStyles, ProblemBanner, type FormProblem } from './AuthForm';
import RequestSentStep from './onboarding/RequestSentStep';
import styles from './JoinByLink.module.css';

const LOCKUP_ALT = 'hushmate, Less shush, more hush.';

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.head}>
        <img className={`${authStyles.logo} ${authStyles.onDark}`} src="/hushmate-lockup-tagline-dark.svg" width="132" height="44" alt={LOCKUP_ALT} />
        <img className={`${authStyles.logo} ${authStyles.onLight}`} src="/hushmate-lockup-tagline-light.svg" width="132" height="44" alt={LOCKUP_ALT} />
      </div>
      {children}
    </main>
  );
}

/** /join/:inviteToken (public). Signed out, the link is remembered through sign-up or sign-in; signed in, one button sends the request. */
export default function JoinByLink() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const invite = useInvite(inviteToken);
  const join = useJoinByInvite();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem>(null);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  if (sentTo) return <RequestSentStep houseName={sentTo} />;

  if (invite.isPending) {
    return (
      <Frame>
        <div className={styles.loading} aria-busy="true" aria-label="Loading invite" />
      </Frame>
    );
  }

  if (invite.isError) {
    const missing = invite.error instanceof ApiError && invite.error.status === 404;
    return (
      <Frame>
        <div className={styles.center}>
          {missing ? (
            <EmptyState
              title="This link doesn't work"
              caption="It may have been mistyped or replaced. Ask your housemate for a fresh one, or search for the house by its ID."
              action={<Button onClick={() => navigate('/')}>Go to Hushmate</Button>}
            />
          ) : (
            <EmptyState
              title="Can't reach Hushmate"
              caption="Check your connection and try again."
              action={<Button onClick={() => void invite.refetch()}>Try again</Button>}
            />
          )}
        </div>
      </Frame>
    );
  }

  const house = invite.data;

  function goAuth(path: '/signup' | '/signin') {
    setReturnTo(`/join/${inviteToken}`);
    navigate(path);
  }

  async function request() {
    if (!inviteToken || join.isPending) return;
    setProblem(null);
    setAlreadyIn(false);
    setRefused(null);
    try {
      await join.mutateAsync(inviteToken);
      setSentTo(house.name);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setAlreadyIn(true);
      else if (err instanceof ApiError && err.status === 403) setRefused(err.messages[0] ?? "You can't join this house.");
      else if (err instanceof ApiError && err.status === 404) void invite.refetch();
      else if (err instanceof ApiError && err.isNetwork) setProblem({ kind: 'network' });
      else setProblem({ kind: 'banner', title: "Couldn't send the request", text: 'Something went wrong. Try again in a moment.' });
    }
  }

  const refusedDemo = refused !== null && /demo/i.test(refused);

  return (
    <Frame>
      <div className={styles.lead}>You have a link to join</div>
      <div className={styles.card}>
        {!refusedDemo && (
          <div className={styles.mark} aria-hidden="true">
            <House size={24} strokeWidth={2} />
          </div>
        )}
        <h1 className={styles.name}>{house.name}</h1>
        <span className={styles.id}>
          {house.name}#{house.code}
        </span>
        {token === null && <p className={styles.body}>Ask to join and the owner will take a look. We'll remember this while you sign up or sign in.</p>}
        {token !== null && !alreadyIn && !refused && <p className={styles.body}>Ask to join and the owner will take a look.</p>}
        {alreadyIn && (
          <div className={`${authStyles.banner} ${authStyles.error} ${styles.banner}`} role="alert">
            <div>
              <span className={authStyles.bannerTitle}>You're already part of this</span>
              <p>You're in {house.name}, or your request is waiting for the owner.</p>
            </div>
          </div>
        )}
        {refused && (
          <div className={`${authStyles.banner} ${authStyles.error} ${styles.banner}`} role="alert">
            <div>
              <span className={authStyles.bannerTitle}>{refused}</span>
              {refusedDemo && <p>Demo houses don't take join requests.</p>}
            </div>
          </div>
        )}
        <ProblemBanner problem={problem} onRetry={() => void request()} />
      </div>
      <div className={styles.actions}>
        {token === null ? (
          <>
            <Button block onClick={() => goAuth('/signup')}>
              Sign up to join
            </Button>
            <Button variant="secondary" block onClick={() => goAuth('/signin')}>
              Sign in to join
            </Button>
          </>
        ) : alreadyIn ? (
          <Button block onClick={() => navigate('/houses')}>
            Go to Houses
          </Button>
        ) : refused ? (
          <Button block onClick={() => navigate('/schedule')}>
            Go to Hushmate
          </Button>
        ) : (
          <>
            <Button block busy={join.isPending} onClick={() => void request()}>
              {join.isPending ? 'Requesting…' : 'Request to join'}
            </Button>
            <Button variant="ghost" block onClick={() => navigate('/schedule')}>
              Not now
            </Button>
          </>
        )}
      </div>
    </Frame>
  );
}
