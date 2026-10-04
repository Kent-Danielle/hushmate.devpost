import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { ME_KEY } from './me';
import type {
  ActivateResponse,
  CreateHouseResponse,
  House,
  HouseListItem,
  InviteInfo,
  InviteLinkResponse,
  JoinRequest,
  JoinResponse,
  User,
} from '../types';

export const HOUSES_KEY = ['houses'] as const;
const requestsKey = (houseId: string) => ['houses', houseId, 'requests'] as const;

export function fetchHouses(queryClient: QueryClient): Promise<HouseListItem[]> {
  return queryClient.fetchQuery({ queryKey: HOUSES_KEY, queryFn: () => api<HouseListItem[]>('/houses'), staleTime: 0 });
}

/** GET /houses: my memberships (any status). */
export function useHouses() {
  return useQuery({ queryKey: HOUSES_KEY, queryFn: () => api<HouseListItem[]>('/houses') });
}

/** POST /houses {name}. The creator is approved at once, so the list and /me (active house) both change. */
export function useCreateHouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<CreateHouseResponse>('/houses', { method: 'POST', body: { name } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HOUSES_KEY });
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

/** GET /houses/lookup?id=Name%23123456 (split on the last # by the server, case-insensitive). */
export function lookupHouse(id: string): Promise<House> {
  return api<House>(`/houses/lookup?id=${encodeURIComponent(id)}`);
}

/** POST /houses/:id/join: a pending membership. */
export function useJoinHouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (houseId: string) => api<JoinResponse>(`/houses/${houseId}/join`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: HOUSES_KEY }),
  });
}

/** GET /invites/:token (public): the house name behind an invite link. */
export function useInvite(token: string | undefined) {
  return useQuery({
    queryKey: ['invites', token],
    queryFn: () => api<InviteInfo>(`/invites/${encodeURIComponent(token ?? '')}`),
    enabled: Boolean(token),
    retry: false,
  });
}

/** POST /invites/:token/join: a pending membership. */
export function useJoinByInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<JoinResponse>(`/invites/${encodeURIComponent(token)}/join`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: HOUSES_KEY }),
  });
}

/** GET /houses/:id/requests (owner only): enabled only when there is something to show. */
export function useJoinRequests(houseId: string, enabled: boolean) {
  return useQuery({ queryKey: requestsKey(houseId), queryFn: () => api<JoinRequest[]>(`/houses/${houseId}/requests`), enabled });
}

/** POST /memberships/:id/approve or /decline. */
export function useDecideRequest(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, decision }: { membershipId: string; decision: 'approve' | 'decline' }) =>
      api<{ status: string }>(`/memberships/${membershipId}/${decision}`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requestsKey(houseId) });
      void queryClient.invalidateQueries({ queryKey: HOUSES_KEY });
    },
  });
}

/** POST /houses/:id/activate. Updates the cached /me at once, so the cards re-sort without waiting. */
export function useActivateHouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (houseId: string) => api<ActivateResponse>(`/houses/${houseId}/activate`, { method: 'POST' }),
    onSuccess: ({ activeHouseId }) => {
      queryClient.setQueryData<User>(ME_KEY, (me) => (me ? { ...me, activeHouseId } : me));
      queryClient.setQueryData<HouseListItem[]>(HOUSES_KEY, (list) => list?.map((h) => ({ ...h, isActive: h.house.id === activeHouseId })));
      void queryClient.invalidateQueries({ queryKey: HOUSES_KEY });
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

/** DELETE /memberships/:id: the requester dismisses a declined card. */
export function useDismissMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => api(`/memberships/${membershipId}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: HOUSES_KEY }),
  });
}

/** POST /memberships/:id/setup-done. */
export function useSetupDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => api(`/memberships/${membershipId}/setup-done`, { method: 'POST' }),
    onSuccess: (_data, membershipId) => {
      // Mark it done in the cache at once, so the setup redirect in RequireAuth doesn't bounce the person back.
      queryClient.setQueryData<HouseListItem[]>(HOUSES_KEY, (list) => list?.map((h) => (h.membershipId === membershipId ? { ...h, setupDone: true } : h)));
      void queryClient.invalidateQueries({ queryKey: HOUSES_KEY });
    },
  });
}

/** GET /houses/:id/invite-link (any approved member). */
export async function fetchInviteLink(houseId: string): Promise<string> {
  return (await api<InviteLinkResponse>(`/houses/${houseId}/invite-link`)).url;
}
