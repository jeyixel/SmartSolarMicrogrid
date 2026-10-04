import React, { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

type AlertVariant = 'default' | 'destructive' | 'warning' | 'success';

interface AlertConfig {
  wrapper: string;
  icon: React.ElementType;
  iconClass: string;
}

const VARIANT_CONFIG: Record<AlertVariant, AlertConfig> = {
  default: {
    wrapper: 'border-border bg-background',
    icon: Info,
    iconClass: 'text-slate-500 dark:text-slate-400',
  },
  destructive: {
    wrapper: 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10',
    icon: AlertCircle,
    iconClass: 'text-red-500',
  },
  warning: {
    wrapper: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10',
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
  },
  success: {
    wrapper: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
  },
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Inline alert component following GridPulse operational status colors.
 * Use for in-form validation feedback. For toast notifications, use <Toaster>.
 */
export const Alert: React.FC<AlertProps> = ({
  variant = 'default',
  title,
  children,
  className,
}) => {
  const { wrapper, icon: Icon, iconClass } = VARIANT_CONFIG[variant];

  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded border px-4 py-3', wrapper, className)}
    >
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', iconClass)} />
      <div className="text-body-sm flex-1">
        {title && (
          <p className="font-medium text-foreground mb-0.5">{title}</p>
        )}
        <div className="text-slate-700 dark:text-slate-300">{children}</div>
      </div>
    </div>
  );
};
