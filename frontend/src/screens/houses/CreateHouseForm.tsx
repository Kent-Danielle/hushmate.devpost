import { useState, type ReactNode } from 'react';
import { ApiError } from '../../api/client';
import { useCreateHouse } from '../../api/hooks/houses';
import type { House } from '../../api/types';
import { Button } from '../../components/Button';
import { authStyles, Field, ProblemBanner, type FormProblem } from '../AuthForm';
import { validateHouseName } from './houseName';

interface Props {
  onCreated: (house: House) => void;
  /** Extra buttons under Create house (for example Back). */
  footer?: ReactNode;
}

/** The create-house form, shared by onboarding and the Create house sheet. */
export default function CreateHouseForm({ onCreated, footer }: Props) {
  const create = useCreateHouse();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem>(null);
  const [working, setWorking] = useState(false);

  async function submit() {
    if (working) return;
    const message = validateHouseName(name);
    setError(message);
    setProblem(null);
    if (message) return;
    setWorking(true);
    try {
      const { house } = await create.mutateAsync(name.trim());
      onCreated(house);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setError(err.messages[0] ?? "That house name won't work.");
      else if (err instanceof ApiError && err.isNetwork) setProblem({ kind: 'network' });
      else if (err instanceof ApiError && err.status === 403) setProblem({ kind: 'banner', title: "Couldn't create a house", text: err.messages[0] ?? 'This account can’t create houses.' });
      else setProblem({ kind: 'banner', title: "Couldn't create the house", text: 'Something went wrong. Try again in a moment.' });
      setWorking(false);
    }
  }

  return (
    <form
      noValidate
      className={authStyles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ProblemBanner problem={problem} onRetry={() => void submit()} />
      <Field
        label="House name"
        id="house-name"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
        hint="No spaces or #. We'll add a number to make it unique, like MapleHouse#482913."
        counter={`${name.trim().length}/30`}
      />
      <div className={authStyles.actions}>
        <Button type="submit" block busy={working}>
          {working ? 'Creating…' : 'Create house'}
        </Button>
        {footer}
      </div>
    </form>
  );
}
