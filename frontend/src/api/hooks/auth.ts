import { useMutation } from '@tanstack/react-query';
import { api } from '../client';
import type { AuthResponse, DemoAssignBody, DemoAssignResponse, SignInBody, SignUpBody } from '../types';

export function useSignUp() {
  return useMutation({ mutationFn: (body: SignUpBody) => api<AuthResponse>('/auth/signup', { method: 'POST', body }) });
}

export function useSignIn() {
  return useMutation({ mutationFn: (body: SignInBody) => api<AuthResponse>('/auth/signin', { method: 'POST', body }) });
}

/** POST /demo/assign (public): the demo account to prefill on /demo. A plain function, not a mutation, so signing out (which clears the query caches) can't disturb it. */
export function assignDemoAccount(body: DemoAssignBody): Promise<DemoAssignResponse> {
  return api<DemoAssignResponse>('/demo/assign', { method: 'POST', body });
}
