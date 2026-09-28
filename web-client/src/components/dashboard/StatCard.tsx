import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

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
  indigo: { icon: 'bg-indigo-50 text-indigo-600', value: 'text-slate-900', glow: 'from-indigo-500/10' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-600', glow: 'from-emerald-500/10' },
  sky: { icon: 'bg-sky-50 text-sky-600', value: 'text-slate-900', glow: 'from-sky-500/10' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700', glow: 'from-amber-500/10' },
  rose: { icon: 'bg-rose-50 text-rose-600', value: 'text-rose-700', glow: 'from-rose-500/10' },
  slate: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900', glow: 'from-slate-500/10' },
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
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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

      {hint && <div className="relative mt-2 text-xs text-slate-500">{hint}</div>}
    </>
  );

  const className = cn(
    'group relative animate-rise-in overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300',
    'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md',
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
