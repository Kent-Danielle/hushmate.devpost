import type { QueryClient } from '@tanstack/react-query';
import { fetchHouses } from '../api/hooks/houses';
import { takeReturnTo } from '../api/session';

/**
 * Where to go after sign-up or sign-in (spec: Frontend: App shell and routing):
 * a stored return-to wins; no memberships -> /onboarding; an approved membership with setupDone false -> its setup;
 * otherwise /schedule.
 */
export async function destinationAfterAuth(queryClient: QueryClient): Promise<string> {
  const returnTo = takeReturnTo();
  if (returnTo) return returnTo;
  try {
    const houses = await fetchHouses(queryClient);
    if (houses.length === 0) return '/onboarding';
    const needsSetup = houses.find((h) => h.status === 'approved' && !h.setupDone);
    if (needsSetup) return `/onboarding/setup/${needsSetup.house.id}`;
  } catch {
    // the houses endpoint isn't reachable yet: fall through to the home tab
  }
  return '/schedule';
}
