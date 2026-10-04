import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../client';
import type { QuietTimeConflict, QuietTimeScope } from '../types';

export interface CreateQuietTimeBody {
  days: number[];
  startMinute: number;
  endMinute: number;
}

/** The clashing rows from a 409 overlap, or null when the error is something else. */
export function conflictsFromError(error: unknown): QuietTimeConflict[] | null {
  if (error instanceof ApiError && error.status === 409) {
    const list = error.body.conflicts;
    return Array.isArray(list) ? (list as QuietTimeConflict[]) : [];
  }
  return null;
}

/** Anything that changes quiet times refreshes the boards (and with them the nudge sheet's resting state). */
function useRefreshBoards() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['houses'] });
}

/** POST /houses/:id/quiet-times: one row per day, sharing a setId. Allowed in the active house, or during that house's setup. */
export function useCreateQuietTime(houseId: string) {
  const refresh = useRefreshBoards();
  return useMutation({
    mutationFn: (body: CreateQuietTimeBody) => api<{ setId: string }>(`/houses/${houseId}/quiet-times`, { method: 'POST', body }),
    onSuccess: () => void refresh(),
  });
}

/** PATCH /quiet-times/:id {startMinute, endMinute, scope}. 'day' splits that day into its own set. */
export function useUpdateQuietTime() {
  const refresh = useRefreshBoards();
  return useMutation({
    mutationFn: ({ id, startMinute, endMinute, scope }: { id: string; startMinute: number; endMinute: number; scope: QuietTimeScope }) =>
      api(`/quiet-times/${id}`, { method: 'PATCH', body: { startMinute, endMinute, scope } }),
    onSuccess: () => void refresh(),
  });
}

/** DELETE /quiet-times/:id?scope=day|set. */
export function useDeleteQuietTime() {
  const refresh = useRefreshBoards();
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: QuietTimeScope }) => api(`/quiet-times/${id}?scope=${scope}`, { method: 'DELETE' }),
    onSuccess: () => void refresh(),
  });
}
