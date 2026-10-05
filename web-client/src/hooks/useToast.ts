import { useState, useEffect } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'warning';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Duration in ms before auto-dismiss. Defaults to 5000. */
  duration?: number;
}

// Module-level handler registry — enables imperative `toast()` calls from
// anywhere in the app without prop-drilling or a React context.
type ToastHandler = (t: ToastMessage) => void;
const _handlers = new Set<ToastHandler>();

/**
 * Imperatively fire a toast notification from any component or utility.
 *
 * @example
 * import { toast } from '../hooks/useToast';
 * toast({ title: '12-Hour Rule Violation', description: err.message, variant: 'destructive' });
 */
export function toast(msg: Omit<ToastMessage, 'id'>) {
  const t: ToastMessage = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    duration: 5000,
    variant: 'default',
    ...msg,
  };
  _handlers.forEach(h => h(t));
}

/**
 * Internal hook used only by <Toaster /> to subscribe to incoming toasts
 * and provide a dismiss callback.
 */
export function useToastListener() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler: ToastHandler = (t) => {
      setToasts(prev => [...prev, t]);
      // Auto-dismiss after duration
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration ?? 5000);
    };

    _handlers.add(handler);
    return () => { _handlers.delete(handler); };
  }, []);

  const dismiss = (id: string) =>
    setToasts(prev => prev.filter(x => x.id !== id));

  return { toasts, dismiss };
}
