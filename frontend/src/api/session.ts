// Per-device session storage. Every read and write is guarded: storage can be unavailable or throw.
const TOKEN_KEY = 'hushmate-token';
export const RETURN_TO_KEY = 'hushmate-return-to';
const THEME_KEY = 'hushmate-theme';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable: the session lasts until the page closes
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing to clear
  }
}

export function setReturnTo(path: string): void {
  try {
    localStorage.setItem(RETURN_TO_KEY, path);
  } catch {
    // the return trip is a convenience only
  }
}

/** Reads and clears the stored return-to path. Only same-app paths are accepted. */
export function takeReturnTo(): string | null {
  try {
    const path = localStorage.getItem(RETURN_TO_KEY);
    localStorage.removeItem(RETURN_TO_KEY);
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}

/** Sign-out step 4: clear every `hushmate-*` key (welcome card, toasted acks, return-to, token) except the theme, which is a device setting. */
export function clearLocalKeys(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('hushmate-') && key !== THEME_KEY) localStorage.removeItem(key);
    }
  } catch {
    // nothing to clear
  }
}
