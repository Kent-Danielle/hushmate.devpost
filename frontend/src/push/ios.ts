export function isIOSDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS reports a Mac user agent
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/** iPhone/iPad in a Safari tab: push only works from the Home Screen app. */
export function needsHomeScreen(): boolean {
  return isIOSDevice() && !isStandalone();
}

/** Copy for the Add to Home Screen guidance (prd.md > Onboarding). `last` differs by where it is shown. */
export function iosSteps(last: string): string[] {
  return [
    'Tap Share in Safari.',
    'Choose Add to Home Screen and keep Open as Web App on.',
    'Open Hushmate from your Home Screen and sign in again.',
    last,
  ];
}
