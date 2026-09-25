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
    0: 'bg-indigo-100 text-indigo-800 border-indigo-200', // Backoffice
    1: 'bg-sky-100 text-sky-800 border-sky-200', // Grid Operator
    2: 'bg-teal-100 text-teal-800 border-teal-200', // Prosumer
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
