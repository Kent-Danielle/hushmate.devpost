import { getToken } from './session';
import type { ApiErrorBody } from './types';

const BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

/** status 0 means the request never reached the server (offline, server down). */
export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly body: Partial<ApiErrorBody> & Record<string, unknown>;

  constructor(status: number, messages: string[], body: ApiError['body'] = {}) {
    super(messages[0] ?? 'Something went wrong');
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.body = body;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

let onUnauthorized: (() => void) | null = null;
/** AuthContext registers the "expired token" handler here. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T = void>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const isAuthRoute = path.startsWith('/auth/');
  const token = isAuthRoute ? null : getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, ["Can't reach Hushmate right now."]);
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  let parsed: ApiError['body'] = {};
  try {
    parsed = (await res.json()) as ApiError['body'];
  } catch {
    // non-JSON error body
  }
  const raw = parsed.message;
  const messages = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [res.statusText || 'Something went wrong'];

  // A 401 from a signed-in route means the token expired or is invalid. From /auth it means wrong credentials.
  if (res.status === 401 && !isAuthRoute && token) onUnauthorized?.();

  throw new ApiError(res.status, messages, parsed);
}
