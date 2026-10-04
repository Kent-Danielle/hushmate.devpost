import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { User } from '../types';

export const ME_KEY = ['me'] as const;

/** GET /me on every app load and on refocus. */
export function useMe(enabled: boolean) {
  return useQuery({ queryKey: ME_KEY, queryFn: () => api<User>('/me'), enabled });
}
