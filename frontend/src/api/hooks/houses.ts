import type { QueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { HouseListItem } from '../types';

export const HOUSES_KEY = ['houses'] as const;

export function fetchHouses(queryClient: QueryClient): Promise<HouseListItem[]> {
  return queryClient.fetchQuery({ queryKey: HOUSES_KEY, queryFn: () => api<HouseListItem[]>('/houses'), staleTime: 0 });
}
