import { useCallback } from 'react';
import { fetchInviteLink } from '../../api/hooks/houses';
import { useToast } from '../../components/Toast';

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Blocked or unsupported (older iOS, an embedded view): fall back to a selected hidden field.
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

/** Copies text and says so in a toast. Falls back to a quiet failure message when the clipboard is blocked. */
export function useCopyText() {
  const toast = useToast();
  return useCallback(
    async (text: string, done: string) => {
      if (await writeClipboard(text)) toast.show(done);
      else toast.show("Couldn't copy that. Try again.");
    },
    [toast],
  );
}

/**
 * Copy invite link: GET /houses/:id/invite-link, then the clipboard. The request happens inside a promised
 * ClipboardItem first, because Safari only allows the write while the tap is still "fresh".
 */
export function useCopyInvite() {
  const copy = useCopyText();
  const toast = useToast();
  return useCallback(
    async (houseId: string) => {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          const blob = fetchInviteLink(houseId).then((url) => new Blob([url], { type: 'text/plain' }));
          await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
          toast.show('Invite link copied');
          return;
        } catch {
          // fall through to the plain path below, which reports a failed request or a blocked clipboard
        }
      }
      let url: string;
      try {
        url = await fetchInviteLink(houseId);
      } catch {
        toast.show("Couldn't get the invite link. Try again.");
        return;
      }
      await copy(url, 'Invite link copied');
    },
    [copy, toast],
  );
}
