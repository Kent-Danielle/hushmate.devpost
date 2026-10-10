import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalKeys, DEMO_ACCOUNT_KEY, getDemoAccount, setDemoAccount } from '../../src/api/session';

// A Storage stand-in: entries are own properties (so Object.keys lists them like the real thing), methods live on the prototype.
class FakeStorage {
  [key: string]: unknown;
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this, key) ? (this[key] as string) : null;
  }
  setItem(key: string, value: string): void {
    this[key] = String(value);
  }
  removeItem(key: string): void {
    delete this[key];
  }
}

let store: FakeStorage;

beforeEach(() => {
  store = new FakeStorage();
  vi.stubGlobal('localStorage', store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearLocalKeys', () => {
  it('clears hushmate-* keys but keeps the theme and the remembered demo account', () => {
    store.setItem('hushmate-token', 't');
    store.setItem('hushmate-return-to', '/join/abc');
    store.setItem('hushmate-demo-welcome-seen', '1');
    store.setItem('hushmate-theme', 'dark');
    store.setItem(DEMO_ACCOUNT_KEY, 'demo1@example.com');
    store.setItem('other-app-key', 'x');

    clearLocalKeys();

    expect(store.getItem('hushmate-token')).toBeNull();
    expect(store.getItem('hushmate-return-to')).toBeNull();
    expect(store.getItem('hushmate-demo-welcome-seen')).toBeNull();
    expect(store.getItem('hushmate-theme')).toBe('dark');
    expect(store.getItem(DEMO_ACCOUNT_KEY)).toBe('demo1@example.com');
    expect(store.getItem('other-app-key')).toBe('x');
  });
});

describe('remembered demo account', () => {
  it('uses the spec key', () => {
    expect(DEMO_ACCOUNT_KEY).toBe('hushmate-demo-account');
  });

  it('round-trips the email and returns null when none is stored', () => {
    expect(getDemoAccount()).toBeNull();
    setDemoAccount('demo2@example.com');
    expect(getDemoAccount()).toBe('demo2@example.com');
  });

  it('treats a blank value as nothing remembered', () => {
    store.setItem(DEMO_ACCOUNT_KEY, '  ');
    expect(getDemoAccount()).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(getDemoAccount()).toBeNull();
    expect(() => setDemoAccount('a@b.c')).not.toThrow();
  });
});
