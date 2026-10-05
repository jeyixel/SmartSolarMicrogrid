import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface AlertBannerProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
}

export default function AlertBanner({
  type = 'info',
  message,
  onClose,
  className = '',
}: AlertBannerProps) {
  if (!message) return null;

  const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    error: 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
    warning: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    info: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  };

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm font-medium ${styles[type]} ${className}`}
    >
      {icons[type]}
      <div className="flex-1">{message}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          aria-label="Dismiss alert"
        >
          &times;
        </button>
      )}
    </div>
  );
}
