import { useMutation } from '@tanstack/react-query';
import { api } from '../client';
import type { AuthResponse, SignInBody, SignUpBody } from '../types';

export function useSignUp() {
  return useMutation({ mutationFn: (body: SignUpBody) => api<AuthResponse>('/auth/signup', { method: 'POST', body }) });
}

export function useSignIn() {
  return useMutation({ mutationFn: (body: SignInBody) => api<AuthResponse>('/auth/signin', { method: 'POST', body }) });
}
