// Per-device session storage. Every read and write is guarded: storage can be unavailable or throw.
const TOKEN_KEY = 'hushmate-token';
export const RETURN_TO_KEY = 'hushmate-return-to';
const THEME_KEY = 'hushmate-theme';
/** The demo account this browser was last handed (/demo). Like the theme, it survives sign-out so a return visit gets the same account. */
export const DEMO_ACCOUNT_KEY = 'hushmate-demo-account';

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

export function getDemoAccount(): string | null {
  try {
    const email = localStorage.getItem(DEMO_ACCOUNT_KEY);
    return email && email.trim() ? email : null;
  } catch {
    return null;
  }
}

export function setDemoAccount(email: string): void {
  try {
    localStorage.setItem(DEMO_ACCOUNT_KEY, email);
  } catch {
    // a return visit may get another demo account, nothing worse
  }
}

/** Sign-out step 4: clear every `hushmate-*` key (welcome card, toasted acks, return-to, token) except the theme (a device setting) and the remembered demo account. */
export function clearLocalKeys(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('hushmate-') && key !== THEME_KEY && key !== DEMO_ACCOUNT_KEY) localStorage.removeItem(key);
    }
  } catch {
    // nothing to clear
  }
}
