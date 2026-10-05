import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Modal dialog following GridPulse design system:
 * - rounded-xl (12px) for floating overlays
 * - shadow-lg permitted for modals per THEME_GUIDE.md
 * - bg-card with border-border
 * - Backdrop closes the dialog
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
}) => {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  // Rendered on <body> so the backdrop covers the whole viewport, including the
  // sticky header and sidebar, whatever layout the dialog is opened from.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim / Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          'relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto',
          'bg-card rounded-xl border border-border shadow-lg',
          'p-6',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2
              id="dialog-title"
              className="text-headline-sm text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p className="text-body-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1 rounded hover:bg-muted text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex-shrink-0"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
};
