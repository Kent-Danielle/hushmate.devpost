import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { VapidKeyResponse } from '../types';
import { syncPushSubscription } from '../../push/register';

/** Prefetched when the notification setup mounts, so nothing is fetched between the tap and `subscribe()`. */
export function useVapidKey(enabled: boolean) {
  return useQuery({
    queryKey: ['push', 'vapid-public-key'],
    queryFn: async () => (await api<VapidKeyResponse>('/push/vapid-public-key')).key,
    enabled,
    staleTime: Infinity,
  });
}

/** On every load with permission granted, re-send the subscription (moves the device to this account, repairs rotation). */
export function usePushSync(): void {
  useEffect(() => {
    void syncPushSubscription().catch(() => {
      // best effort: the next open tries again
    });
  }, []);
}

/** The service worker posts {type} when a push arrives or a notification is tapped. */
export function useServiceWorkerMessages(navigate: (path: string) => void): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string; clicked?: boolean } | null;
      if (!data?.type) return;
      void queryClient.invalidateQueries({ queryKey: ['nudges', 'pending'] });
      if (data.clicked && data.url) {
        try {
          const target = new URL(data.url, window.location.origin);
          if (target.origin === window.location.origin) navigate(target.pathname + target.search);
        } catch {
          // ignore a malformed url
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [queryClient, navigate]);
}
