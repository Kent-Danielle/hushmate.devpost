import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { useActivateHouse, useDismissMembership, useHouses } from '../../api/hooks/houses';
import type { House, HouseListItem } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { HouseCard } from '../../components/HouseCard';
import { useToast } from '../../components/Toast';
import CreateHouseSheet from './CreateHouseSheet';
import JoinByIdSheet from './JoinByIdSheet';
import RequestsList from './RequestsList';
import { useCopyInvite } from './useCopyInvite';
import styles from './HousesPage.module.css';

const ORDER: Record<string, number> = { active: 0, inactive: 1, pending: 2, declined: 3 };
function rank(h: HouseListItem): number {
  return ORDER[h.status === 'approved' ? (h.isActive ? 'active' : 'inactive') : h.status];
}

export default function HousesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const houses = useHouses();
  const activate = useActivateHouse();
  const dismiss = useDismissMembership();
  const copyInvite = useCopyInvite();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const locked = Boolean(user?.isDemo);

  // Schedule's "Create a house" button lands here with the sheet open.
  useEffect(() => {
    if ((location.state as { openCreate?: boolean } | null)?.openCreate && !locked) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, locked]);

  const sorted = useMemo(
    () => [...(houses.data ?? [])].sort((a, b) => rank(a) - rank(b)),
    [houses.data],
  );

  async function makeActive(item: HouseListItem) {
    setBusyId(item.membershipId);
    try {
      await activate.mutateAsync(item.house.id);
      toast.show(`${item.house.name} is now your active house`);
    } catch {
      toast.show("Couldn't switch houses. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissCard(item: HouseListItem) {
    setBusyId(item.membershipId);
    try {
      await dismiss.mutateAsync(item.membershipId);
    } catch {
      toast.show("Couldn't dismiss that. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  function created(house: House) {
    setCreateOpen(false);
    toast.show(`${house.name}#${house.code} created`);
  }

  function requested(house: House) {
    setJoinOpen(false);
    toast.show(`Request sent to ${house.name}`);
  }

  const controls = !locked && (
    <div className={styles.actions}>
      <Button icon={<Plus size={18} strokeWidth={2} aria-hidden="true" />} onClick={() => setCreateOpen(true)}>
        Create house
      </Button>
      <Button variant="secondary" onClick={() => setJoinOpen(true)}>
        Join a house
      </Button>
    </div>
  );

  let body;
  if (houses.isPending) {
    body = (
      <div aria-busy="true" aria-label="Loading houses" className={styles.list}>
        <div className={styles.skel} />
        <div className={styles.skel} />
        <div className={styles.skel} />
      </div>
    );
  } else if (houses.isError && !houses.data) {
    body = (
      <div className={styles.net} role="status">
        <span>Can't reach Hushmate right now.</span>
        <Button variant="ghost" small onClick={() => void houses.refetch()}>
          Try again
        </Button>
      </div>
    );
  } else if (sorted.length === 0) {
    body = (
      <div className={styles.center}>
        <EmptyState
          title="No houses yet"
          caption="Create one for your housemates, or join the one you already share."
        />
      </div>
    );
  } else {
    body = (
      <>
        {houses.isError && (
          <div className={styles.net} role="status">
            <span>Can't reach Hushmate right now.</span>
            <Button variant="ghost" small onClick={() => void houses.refetch()}>
              Try again
            </Button>
          </div>
        )}
        <ul className={styles.list}>
          {sorted.map((item) => (
            <HouseCard
              key={item.membershipId}
              item={item}
              locked={locked}
              busy={busyId === item.membershipId}
              onMakeActive={() => void makeActive(item)}
              onCopyInvite={() => void copyInvite(item.house.id)}
              onDismiss={() => void dismissCard(item)}
            />
          ))}
        </ul>
        {!locked && sorted.map((item) => <RequestsList key={item.membershipId} item={item} />)}
      </>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Houses</h1>
        <p className={styles.caption}>One is active at a time</p>
      </div>
      {!houses.isPending && controls}
      {body}
      {!locked && <CreateHouseSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={created} />}
      {!locked && <JoinByIdSheet open={joinOpen} onOpenChange={setJoinOpen} onRequested={requested} />}
    </section>
  );
}
