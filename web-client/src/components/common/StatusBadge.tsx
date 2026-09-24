import React from 'react';
import { parseAccountStatus, getStatusLabel } from '../../types/user';

interface StatusBadgeProps {
  status: unknown;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const parsed = parseAccountStatus(status);
  const label = getStatusLabel(status);

  const styles = {
    0: 'bg-amber-100 text-amber-800 border-amber-300', // Pending
    1: 'bg-emerald-100 text-emerald-800 border-emerald-300', // Active
    2: 'bg-slate-100 text-slate-700 border-slate-300', // Deactivated
  };

  const dots = {
    0: 'bg-amber-500',
    1: 'bg-emerald-500',
    2: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        styles[parsed]
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[parsed]}`} />
      {label}
    </span>
  );
}
