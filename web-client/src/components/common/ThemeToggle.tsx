import { Monitor, Moon, Sun } from 'lucide-react';

import type { ThemePreference } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'Use system theme', icon: Monitor },
];

interface ThemeToggleProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

/** Compact segmented control: Light / Dark / System. */
export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5"
    >
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
