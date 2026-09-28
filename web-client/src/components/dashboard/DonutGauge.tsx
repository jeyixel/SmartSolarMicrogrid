/**
 * A single-value ring gauge drawn as inline SVG.
 *
 * Inline rather than a charting library: this is one arc, and pulling in a
 * chart dependency for it would cost more bundle than the whole dashboard.
 * The value is always printed in the middle, so the reading never depends on
 * judging the arc length or the colour.
 */
interface DonutGaugeProps {
  /** 0-100. Values outside the range are clamped rather than overflowing the ring. */
  value: number;
  /** Large text in the centre. Defaults to "<value>%". */
  label?: string;
  /** Small text under the label. */
  caption?: string;
  size?: number;
  strokeWidth?: number;
  /** Tailwind text-* class driving the arc colour via currentColor. */
  colorClassName?: string;
}

export function DonutGauge({
  value,
  label,
  caption,
  size = 132,
  strokeWidth = 12,
  colorClassName = 'text-indigo-500',
}: DonutGaugeProps) {
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safeValue / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label ?? `${Math.round(safeValue)}%`}${caption ? `, ${caption}` : ''}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={`${colorClassName} stroke-current transition-[stroke-dasharray] duration-700 ease-out`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {label ?? `${Math.round(safeValue)}%`}
        </span>
        {caption && (
          <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
