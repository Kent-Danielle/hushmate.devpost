import { endpointHost, isAllowedPushEndpoint } from './push-hosts.js';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('allows %s', (endpoint) => expect(isAllowedPushEndpoint(endpoint)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://evil.example.com/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.com/x',
    'https://evilpush.apple.com.attacker.io/x',
    'https://push.apple.com/x',
    'https://user:pw@fcm.googleapis.com/x',
    'not a url',
    '',
  ])('rejects %s', (endpoint) => expect(isAllowedPushEndpoint(endpoint)).toBe(false));

  it('logs only the host', () => {
    expect(endpointHost('https://fcm.googleapis.com/fcm/send/secret')).toBe('fcm.googleapis.com');
  });
});
