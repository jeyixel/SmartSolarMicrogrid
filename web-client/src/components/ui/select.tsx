import React from 'react';
import { cn } from '../../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Styled native <select> element following GridPulse design tokens.
 * Uses border-input (slate-300) and focuses to primary (indigo).
 * Drop-in replacement for Shadcn Select when @radix-ui/react-select is not available.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded border border-input bg-white px-3 py-1.5',
        'text-body-md text-slate-800 cursor-pointer',
        'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export { Select };
