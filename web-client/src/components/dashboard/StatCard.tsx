import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cn } from '@/lib/utils';

/**
 * One KPI tile.
 *
 * Accents are picked from a fixed map rather than composed from props, because
 * Tailwind only emits classes it can see as complete strings - a class built
 * at runtime like `bg-${tone}-50` would be stripped from the build.
 */
export type StatTone = 'indigo' | 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

const TONE_STYLES: Record<StatTone, { icon: string; value: string; glow: string }> = {
  indigo: { icon: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', value: 'text-foreground', glow: 'from-indigo-500/10' },
  emerald: { icon: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', value: 'text-emerald-600 dark:text-emerald-400', glow: 'from-emerald-500/10' },
  sky: { icon: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400', value: 'text-foreground', glow: 'from-sky-500/10' },
  amber: { icon: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', value: 'text-amber-700 dark:text-amber-400', glow: 'from-amber-500/10' },
  rose: { icon: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400', value: 'text-rose-700 dark:text-rose-400', glow: 'from-rose-500/10' },
  slate: { icon: 'bg-muted text-muted-foreground', value: 'text-foreground', glow: 'from-slate-500/10' },
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: StatTone;
  /** Renders the whole tile as a link when given. */
  to?: string;
  /** Entrance delay in ms, so a row of tiles animates in sequence. */
  delayMs?: number;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'slate',
  to,
  delayMs = 0,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];

  const inner = (
    <>
      {/* Soft corner wash, so the tiles are not flat white rectangles. */}
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl',
          styles.glow,
        )}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110',
            styles.icon,
          )}
        >
          {icon}
        </div>
      </div>

      <p className={cn('relative mt-4 font-display text-3xl font-bold tracking-tight', styles.value)}>
        {value}
      </p>

      {hint && <div className="relative mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </>
  );

  const className = cn(
    'group relative animate-rise-in overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300',
    'hover:-translate-y-0.5 hover:border-input hover:shadow-md',
  );

  if (to) {
    return (
      <Link to={to} className={className} style={{ animationDelay: `${delayMs}ms` }}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={className} style={{ animationDelay: `${delayMs}ms` }}>
      {inner}
    </div>
  );
}
