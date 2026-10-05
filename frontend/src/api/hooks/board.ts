import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { Board } from '../types';

export const boardKey = (houseId: string) => ['houses', houseId, 'board'] as const;

/** GET /houses/:id/board: members (with isYou / isAway) and every member's quiet times. */
export function useBoard(houseId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: boardKey(houseId ?? ''),
    queryFn: () => api<Board>(`/houses/${houseId}/board`),
    enabled: enabled && Boolean(houseId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
