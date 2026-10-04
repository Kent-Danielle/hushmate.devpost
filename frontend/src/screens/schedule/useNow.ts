import { useEffect, useState } from 'react';

/** The current time, refreshed every `everyMs` while the page is visible (and on return to it). */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    const timer = window.setInterval(tick, everyMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [everyMs]);
  return now;
}
