import React from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useToastListener, ToastVariant } from '../../hooks/useToast';

interface VariantConfig {
  wrapper: string;
  icon: React.ElementType;
  iconClass: string;
  borderAccent: string;
}

const VARIANT_CONFIG: Record<ToastVariant, VariantConfig> = {
  default: {
    wrapper: 'bg-card border-border',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    borderAccent: 'border-l-emerald-500',
  },
  destructive: {
    wrapper: 'bg-card border-red-200 dark:border-red-500/30',
    icon: AlertCircle,
    iconClass: 'text-red-500',
    borderAccent: 'border-l-red-500',
  },
  warning: {
    wrapper: 'bg-card border-amber-200 dark:border-amber-500/30',
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    borderAccent: 'border-l-amber-500',
  },
};

/**
 * Renders active toast notifications in the top-right corner.
 * Mount this once in the root layout (e.g. App.tsx).
 * Toasts are triggered imperatively via the `toast()` function from useToast.ts.
 */
export const Toaster: React.FC = () => {
  const { toasts, dismiss } = useToastListener();

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      style={{ minWidth: '22rem', maxWidth: '28rem' }}
    >
      {toasts.map(t => {
        const variant = t.variant ?? 'default';
        const { wrapper, icon: Icon, iconClass, borderAccent } = VARIANT_CONFIG[variant];

        return (
          <div
            key={t.id}
            role="alert"
            className={[
              'flex items-start gap-3 rounded-lg border border-l-4 shadow-lg px-4 py-3',
              'pointer-events-auto animate-in slide-in-from-right-2 duration-200',
              wrapper,
              borderAccent,
            ].join(' ')}
          >
            <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconClass}`} />

            <div className="flex-1 min-w-0">
              <p className="text-body-md text-foreground font-semibold leading-snug">
                {t.title}
              </p>
              {t.description && (
                <p className="text-body-sm text-muted-foreground mt-1 leading-snug">
                  {t.description}
                </p>
              )}
            </div>

            <button
              onClick={() => dismiss(t.id)}
              className="ml-1 p-0.5 flex-shrink-0 rounded hover:bg-muted text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
