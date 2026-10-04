import { api } from '../api/client';
import type { PushSubscriptionBody, VapidKeyResponse } from '../api/types';

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Registers /sw.js (root scope) after the window loads. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // push is unavailable without the worker; the rest of the app still works
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toBody(subscription: PushSubscription): PushSubscriptionBody {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint ?? subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } };
}

export function postSubscription(subscription: PushSubscription): Promise<void> {
  return api('/push/subscriptions', { method: 'POST', body: toBody(subscription) });
}

export class PermissionNotGranted extends Error {
  readonly permission: NotificationPermission;
  constructor(permission: NotificationPermission) {
    super(`Notification permission: ${permission}`);
    this.permission = permission;
  }
}

/**
 * The tap handler. Call it straight from the click, with the registration and key already in hand:
 * on iPhone, any await between the tap and these two calls can lose the user gesture.
 */
export async function enablePush(registration: ServiceWorkerRegistration, vapidKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PermissionNotGranted(permission);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  await postSubscription(subscription);
}

/** Silent re-sync on app open. If permission is granted but the subscription is gone (e.g. after sign-out), subscribe again. */
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { key } = await api<VapidKeyResponse>('/push/vapid-public-key');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await postSubscription(subscription);
}

/**
 * Sign-out step 1. Try the server DELETE; if that fails (offline, expired token) or is skipped,
 * unsubscribe in the browser so the push service answers 410 and the backend drops the row. Never throws.
 */
export async function unregisterPush({ server }: { server: boolean }): Promise<void> {
  try {
    if (!pushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration(); // resolves at once, even with none registered
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    if (server) {
      try {
        await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } });
        return;
      } catch {
        // fall through to the browser-side unsubscribe
      }
    }
    await subscription.unsubscribe();
  } catch {
    // signing out must never fail from the user's point of view
  }
}
