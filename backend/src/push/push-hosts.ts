const EXACT_HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com']);
const SUFFIX_HOSTS = ['.push.apple.com', '.notify.windows.com'];

/** True only for an `https:` URL on a known browser push service. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || SUFFIX_HOSTS.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** Host only: full endpoints are credentials and never get logged. */
export function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid';
  }
}
