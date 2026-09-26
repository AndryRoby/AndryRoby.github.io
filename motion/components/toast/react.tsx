'use client';
// ARLing Motion: Toast for React. A thin wrapper: the vanilla toaster owns the growth from
// the click point, the stack, timers, ARIA and the keyboard; React gives it a region and a hook.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/toast'.
import * as React from 'react';
import { createToaster } from '@/lib/arling-motion/toast';

type Point = { x: number; y: number };
type ToastOptions = { description?: string; duration?: number; from?: Point };
type ToasterApi = {
  toast: (message: string, o?: ToastOptions) => number;
  dismiss: (id: number) => unknown;
  dismissAll: () => unknown;
  destroy: () => void;
};

const ToasterContext = React.createContext<ToasterApi | null>(null);

export interface ToasterProps {
  children?: React.ReactNode;
  /** Seconds before a toast leaves on its own (default 4; Infinity keeps it). */
  duration?: number;
  /** Toasts visible in the folded stack (default 3). */
  max?: number;
  /** Name of the notification region (default "Notifications"). */
  label?: string;
  className?: string;
  reducedMotion?: boolean;
}

/** Put once near the root of the app; children can call useToast(). */
export function Toaster({ children, duration, max, label = 'Notifications', className, reducedMotion }: ToasterProps) {
  const ref = React.useRef<HTMLElement>(null);
  const [api, setApi] = React.useState<ToasterApi | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const a = createToaster({ root: ref.current, duration, max, reduced: reducedMotion }) as unknown as ToasterApi;
    setApi(a);
    return () => {
      a.destroy();
      setApi(null);
    };
  }, [duration, max, reducedMotion]);

  return (
    <ToasterContext.Provider value={api}>
      {children}
      <section ref={ref} aria-label={label} className={['am-toaster', className].filter(Boolean).join(' ')}>
        <ol className="am-toaster-list" />
      </section>
    </ToasterContext.Provider>
  );
}

/**
 * const toast = useToast();
 * <button onClick={(e) => toast('Draft saved', { event: e })}>Save</button>
 * Passing the click event makes the toast grow out of the point that was clicked.
 */
export function useToast() {
  const api = React.useContext(ToasterContext);
  return React.useCallback(
    (message: string, o: Omit<ToastOptions, 'from'> & { event?: React.MouseEvent | MouseEvent } = {}) => {
      if (!api) return -1;
      const { event, ...rest } = o;
      const from = event && event.detail > 0 ? { x: event.clientX, y: event.clientY } : undefined;
      return api.toast(message, { ...rest, from });
    },
    [api],
  );
}
