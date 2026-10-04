import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { ApiError } from '../../api/client';
import { lookupHouse, useJoinHouse } from '../../api/hooks/houses';
import type { House } from '../../api/types';
import { Button } from '../../components/Button';
import { authStyles, Field, ProblemBanner, type FormProblem } from '../AuthForm';
import styles from './JoinByIdForm.module.css';

interface Props {
  /** Called with the house once the request is sent (a pending membership exists). */
  onRequested: (house: House) => void;
  footer?: ReactNode;
}

/** Join by ID: look the house up, show the result card, then Request to join. Shared by onboarding and the Join sheet. */
export default function JoinByIdForm({ onRequested, footer }: Props) {
  const join = useJoinHouse();
  const [id, setId] = useState('');
  const [found, setFound] = useState<House | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem>(null);
  const [finding, setFinding] = useState(false);
  const [requesting, setRequesting] = useState(false);

  async function find() {
    if (finding) return;
    const value = id.trim();
    setError(null);
    setProblem(null);
    setFound(null);
    if (!value) {
      setError('Enter the house ID, like MapleHouse#482913.');
      return;
    }
    setFinding(true);
    try {
      setFound(await lookupHouse(value));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setError("We couldn't find that house. Check the name and number and try again.");
      else if (err instanceof ApiError && err.isNetwork) setProblem({ kind: 'network' });
      else setProblem({ kind: 'banner', title: "Couldn't look that up", text: 'Something went wrong. Try again in a moment.' });
    } finally {
      setFinding(false);
    }
  }

  async function request() {
    if (!found || requesting) return;
    setError(null);
    setProblem(null);
    setRequesting(true);
    try {
      await join.mutateAsync(found.id);
      onRequested(found);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError(`You've already asked to join ${found.name}, or you're in it.`);
      else if (err instanceof ApiError && err.status === 403) setError(err.messages[0] ?? "You can't join that house.");
      else if (err instanceof ApiError && err.isNetwork) setProblem({ kind: 'network' });
      else setProblem({ kind: 'banner', title: "Couldn't send the request", text: 'Something went wrong. Try again in a moment.' });
      setRequesting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <ProblemBanner problem={problem} onRetry={() => void (found ? request() : find())} />
      <form
        noValidate
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void find();
        }}
      >
        <Field
          label="House ID"
          id="house-id"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setFound(null);
            setError(null);
          }}
          error={error}
          hint="The name and the number, like MapleHouse#482913."
        />
        <Button type="submit" variant="secondary" block busy={finding} icon={<Search size={18} strokeWidth={2} aria-hidden="true" />}>
          {finding ? 'Looking…' : 'Find house'}
        </Button>
      </form>

      {found && (
        <>
          <div className={styles.result}>
            <b className={styles.resultName}>{found.name}</b>
            <p className={styles.resultId}>
              {found.name}#{found.code}
            </p>
            <Button block busy={requesting} onClick={() => void request()}>
              {requesting ? 'Requesting…' : 'Request to join'}
            </Button>
          </div>
          <p className={styles.note}>The owner will see your request in Houses and can say yes or no.</p>
        </>
      )}
      <div className={authStyles.actions}>{footer}</div>
    </div>
  );
}
