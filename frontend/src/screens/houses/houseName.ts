/** House names: trimmed, 2-30 characters, no spaces, no `#` (same rules as the backend). Returns a message, or null when fine. */
export function validateHouseName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return 'Use at least 2 characters.';
  if (name.length > 30) return 'Use 30 characters or fewer.';
  if (/[\s#]/.test(name)) return "House names can't have spaces or #.";
  return null;
}
