import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Copy, House as HouseIcon, Link as LinkIcon } from 'lucide-react';
import type { House } from '../../api/types';
import { Button } from '../../components/Button';
import CreateHouseForm from '../houses/CreateHouseForm';
import JoinByIdForm from '../houses/JoinByIdForm';
import { useCopyInvite, useCopyText } from '../houses/useCopyInvite';
import RequestSentStep from './RequestSentStep';
import styles from './Onboarding.module.css';

type Step = { name: 'choose' } | { name: 'create' } | { name: 'join' } | { name: 'created'; house: House } | { name: 'sent'; houseName: string };

/** Onboarding, Start: create a house or ask to join one. Setup (quiet times, notifications) is a separate part. */
export default function HouseStep() {
  const [step, setStep] = useState<Step>({ name: 'choose' });
  const back = (
    <Button variant="ghost" block onClick={() => setStep({ name: 'choose' })}>
      Back
    </Button>
  );

  if (step.name === 'sent') return <RequestSentStep houseName={step.houseName} />;
  if (step.name === 'created') return <HouseCreated house={step.house} />;

  if (step.name === 'create') {
    return (
      <main className={styles.screen}>
        <div className={styles.head}>
          <h1 className={styles.title}>Name your house</h1>
        </div>
        <CreateHouseForm onCreated={(house) => setStep({ name: 'created', house })} footer={back} />
      </main>
    );
  }

  if (step.name === 'join') {
    return (
      <main className={styles.screen}>
        <div className={styles.head}>
          <h1 className={styles.title}>Join a house</h1>
          <p className={styles.sub}>Search by ID, or open an invite link from your housemate.</p>
        </div>
        <JoinByIdForm onRequested={(house) => setStep({ name: 'sent', houseName: house.name })} footer={back} />
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <div className={styles.head}>
        <h1 className={styles.title}>Set up your house</h1>
        <p className={styles.sub}>Make a house for your housemates, or join the one you already share.</p>
      </div>
      <div className={styles.choices}>
        <button type="button" className={styles.choice} onClick={() => setStep({ name: 'create' })}>
          <HouseIcon size={24} strokeWidth={2} aria-hidden="true" />
          <span className={styles.choiceText}>
            <b>Create a house</b>
            <span>Start fresh and invite your housemates.</span>
          </span>
          <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" className={styles.choice} onClick={() => setStep({ name: 'join' })}>
          <LinkIcon size={24} strokeWidth={2} aria-hidden="true" />
          <span className={styles.choiceText}>
            <b>Join a house</b>
            <span>Use an invite link or a house ID.</span>
          </span>
          <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

/** "House created": the Name#123456 ID and Copy invite link, then on into Setup. */
function HouseCreated({ house }: { house: House }) {
  const navigate = useNavigate();
  const copyText = useCopyText();
  const copyInvite = useCopyInvite();
  return (
    <main className={styles.screen}>
      <div className={styles.head}>
        <h1 className={styles.title}>{house.name} is ready</h1>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Your house ID</span>
        <div className={styles.cardRow}>
          <span className={styles.houseId}>
            {house.name}
            <span>#{house.code}</span>
          </span>
          <button type="button" className={styles.iconBtn} aria-label="Copy house ID" onClick={() => void copyText(`${house.name}#${house.code}`, 'House ID copied')}>
            <Copy size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <p className={styles.cardNote}>Share the ID or the invite link. Anyone who asks to join waits for your OK in Houses.</p>
      </div>
      <Button variant="secondary" block icon={<LinkIcon size={18} strokeWidth={2} aria-hidden="true" />} onClick={() => void copyInvite(house.id)}>
        Copy invite link
      </Button>
      <div className={styles.bottom}>
        <Button block onClick={() => navigate(`/onboarding/setup/${house.id}`)}>
          Continue
        </Button>
      </div>
    </main>
  );
}
