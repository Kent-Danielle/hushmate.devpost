import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../client';
import { ME_KEY } from './me';
import type { AcknowledgeResponse, NudgeSent, PendingNudge, User } from '../types';

export const PENDING_KEY = ['nudges', 'pending'] as const;

/** GET /nudges/pending: checked on load and on every refocus (TanStack refetches on window focus), and when a push arrives. */
export function usePendingNudges() {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => api<PendingNudge[]>('/nudges/pending'),
    refetchOnMount: 'always',
    // Desktop Safari shows the push itself but never fires the service worker event, so poll while the page is visible.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

/** POST /nudges/acknowledge: acknowledges everything pending, then clears the cache and any leftover system notifications. */
export function useAcknowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<AcknowledgeResponse>('/nudges/acknowledge', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData<PendingNudge[]>(PENDING_KEY, []);
      void queryClient.invalidateQueries({ queryKey: PENDING_KEY });
      void closeNudgeNotifications();
    },
  });
}

/** Closes leftover `nudge` notifications. Best effort: not every browser supports getNotifications. */
async function closeNudgeNotifications(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const open = (await registration?.getNotifications({ tag: 'nudge' })) ?? [];
    for (const notification of open) notification.close();
  } catch {
    // leftover notifications are harmless
  }
}

/** The 429 body carries the time the cooldown ends. */
export function cooldownFromError(error: unknown): string | null {
  if (error instanceof ApiError && error.status === 429) {
    const until = error.body.cooldownUntil;
    return typeof until === 'string' ? until : null;
  }
  return null;
}

/** POST /nudges {recipientId}. The cooldown (from the 201 or the 429) is written into the cached /me so every screen agrees. */
export function useSendNudge() {
  const queryClient = useQueryClient();
  const remember = (cooldownUntil: string) =>
    queryClient.setQueryData<User>(ME_KEY, (me) => (me ? { ...me, nudgeCooldownUntil: cooldownUntil } : me));
  return useMutation({
    mutationFn: (recipientId: string) => api<NudgeSent>('/nudges', { method: 'POST', body: { recipientId } }),
    onSuccess: ({ cooldownUntil }) => remember(cooldownUntil),
    onError: (error) => {
      const until = cooldownFromError(error);
      if (until) remember(until);
    },
  });
}

/** Whole seconds left until `until` (ISO string); 0 when there is none or it has passed. Ticks once a second only while counting. */
export function useCountdown(until: string | null | undefined): number {
  const target = until ? Date.parse(until) : NaN;
  const compute = () => (Number.isFinite(target) ? Math.max(0, Math.ceil((target - Date.now()) / 1000)) : 0);
  const [seconds, setSeconds] = useState(compute);

  useEffect(() => {
    const tick = () => setSeconds(Number.isFinite(target) ? Math.max(0, Math.ceil((target - Date.now()) / 1000)) : 0);
    tick();
    if (!Number.isFinite(target) || target <= Date.now()) return;
    const timer = window.setInterval(() => {
      tick();
      if (target <= Date.now()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  return seconds;
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
