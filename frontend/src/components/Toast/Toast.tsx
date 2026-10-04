import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import styles from './Toast.module.css';

/** `neutral` has a grey dot; `ack` (mint) is reserved for acknowledgements. */
type Tone = 'neutral' | 'ack';
interface Item {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void } | null>(null);

/** One toast at a time: a new one replaces the current one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<Item | null>(null);
  const show = useCallback((message: string, tone: Tone = 'neutral') => setItem({ id: Date.now(), message, tone }), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider duration={4000} swipeDirection="down" label="Notice">
        {children}
        {item && (
          <RadixToast.Root
            key={item.id}
            className={`${styles.toast} ${item.tone === 'ack' ? styles.ack : ''}`}
            onOpenChange={(open) => {
              if (!open) setItem((current) => (current?.id === item.id ? null : current));
            }}
          >
            <i className={styles.dot} aria-hidden="true" />
            <RadixToast.Description>{item.message}</RadixToast.Description>
          </RadixToast.Root>
        )}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
