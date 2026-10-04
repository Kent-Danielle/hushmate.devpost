import { randomBytes, randomInt } from 'node:crypto';

/** A 6-digit house code, 100000-999999 (never a leading zero, so it reads the same everywhere). */
export function randomCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

/** An invite token: 32 random bytes, base64url (43 characters). */
export function randomInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** A random whole number of minutes in [min, max], inclusive. */
export function randomMinutes(min: number, max: number): number {
  return randomInt(min, max + 1);
}
