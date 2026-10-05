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

// The copy lives in lib/copy.ts (spec: Frontend: Shared lib); re-exported so existing imports keep working.
export { iosSteps } from '../lib/copy';
