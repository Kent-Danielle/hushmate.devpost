import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

const NO_RETRY = new Set([400, 401, 403, 404, 409, 429]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !(error instanceof ApiError && NO_RETRY.has(error.status)) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
  },
});
