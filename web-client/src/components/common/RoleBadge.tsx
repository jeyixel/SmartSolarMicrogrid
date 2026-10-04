import React from 'react';
import { parseUserRole, getRoleLabel } from '../../types/user';

interface RoleBadgeProps {
  role: unknown;
  className?: string;
}

export default function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  const parsed = parseUserRole(role);
  const label = getRoleLabel(role);

  const styles = {
    0: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30', // Backoffice
    1: 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-500/30', // Grid Operator
    2: 'bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-500/30', // Prosumer
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
        styles[parsed]
      } ${className}`}
    >
      {label}
    </span>
  );
}
