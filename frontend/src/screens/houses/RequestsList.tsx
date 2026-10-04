import { useDecideRequest, useJoinRequests } from '../../api/hooks/houses';
import type { HouseListItem } from '../../api/types';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import styles from './RequestsList.module.css';

function askedAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Asked just now';
  if (minutes < 60) return `Asked ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Asked ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `Asked ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** The owner's join requests for one house, with Approve and Decline. Renders nothing when there are none. */
export default function RequestsList({ item }: { item: HouseListItem }) {
  const houseId = item.house.id;
  const requests = useJoinRequests(houseId, item.isOwner && item.pendingCount > 0);
  const decide = useDecideRequest(houseId);
  const toast = useToast();
  const rows = requests.data ?? [];
  if (!item.isOwner || item.pendingCount === 0 || rows.length === 0) return null;

  const deciding = decide.isPending ? decide.variables : undefined;

  async function act(membershipId: string, name: string, decision: 'approve' | 'decline') {
    try {
      await decide.mutateAsync({ membershipId, decision });
      toast.show(decision === 'approve' ? `${name} is in` : `Declined ${name}'s request`);
    } catch {
      toast.show("Couldn't do that. Try again.");
    }
  }

  return (
    <section className={styles.section} aria-labelledby={`requests-${houseId}`}>
      <div className={styles.head}>
        <h2 className={styles.title} id={`requests-${houseId}`}>
          Requests
        </h2>
        <span className={styles.tag}>{rows.length}</span>
      </div>
      <p className={styles.caption}>People asking to join {item.house.name}. They only see your house once you say yes.</p>
      <ul className={styles.list}>
        {rows.map((r) => {
          const mine = deciding?.membershipId === r.membershipId ? deciding.decision : null;
          return (
            <li key={r.membershipId} className={styles.row}>
              <div className={styles.avatar} aria-hidden="true">
                {r.name.trim().charAt(0).toUpperCase()}
              </div>
              <div className={styles.who}>
                <b>{r.name}</b>
                <span>{askedAgo(r.createdAt)}</span>
              </div>
              <div className={styles.actions}>
                <Button small busy={mine === 'approve'} disabled={mine === 'decline'} onClick={() => void act(r.membershipId, r.name, 'approve')} aria-label={`Approve ${r.name}`}>
                  Approve
                </Button>
                <Button small variant="secondary" busy={mine === 'decline'} disabled={mine === 'approve'} onClick={() => void act(r.membershipId, r.name, 'decline')} aria-label={`Decline ${r.name}`}>
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
