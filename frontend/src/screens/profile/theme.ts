export type ThemeChoice = 'device' | 'light' | 'dark';

// Same key main.tsx reads at boot. Per device; deliberately kept across sign-out.
const THEME_KEY = 'hushmate-theme';

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'device';
  } catch {
    return 'device';
  }
}

/** Applies at once (data-theme on <html>) and remembers it on this device. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'device') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  try {
    if (choice === 'device') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // applied for this visit only
  }
}
