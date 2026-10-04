import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { Summary } from '../types';

export const summaryKey = (houseId: string) => ['houses', houseId, 'summary'] as const;

/** GET /houses/:id/summary. Refetches every 30 seconds while the page is visible (and on refocus). */
export function useSummary(houseId: string | null | undefined) {
  return useQuery({
    queryKey: summaryKey(houseId ?? ''),
    queryFn: () => api<Summary>(`/houses/${houseId}/summary`),
    enabled: Boolean(houseId),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
