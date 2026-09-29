import { Input } from '@/components/ui/input';
import { DAYS_OF_WEEK, type DayOfWeek, type ScheduleEntry } from '@/api/types';

interface ScheduleEditorProps {
  value: ScheduleEntry[];
  onChange: (next: ScheduleEntry[]) => void;
  disabled?: boolean;
}

/**
 * Weekly opening hours.
 *
 * Always renders all seven days, each with an "open this day" checkbox. The API
 * rejects duplicate days, so a fixed row per day makes that failure impossible
 * to produce rather than merely reporting it afterwards.
 *
 * A day left unchecked is submitted with `isClosed: true` rather than omitted,
 * so "closed on Sunday" and "hours not recorded" stay distinguishable.
 */
export function ScheduleEditor({ value, onChange, disabled }: ScheduleEditorProps) {
  const byDay = new Map(value.map((entry) => [entry.dayOfWeek, entry]));

  function update(day: DayOfWeek, patch: Partial<ScheduleEntry>) {
    const existing = byDay.get(day) ?? {
      dayOfWeek: day,
      openTime: '06:00',
      closeTime: '20:00',
      isClosed: false,
    };

    const merged: ScheduleEntry = { ...existing, ...patch };
    const next = DAYS_OF_WEEK.map((d) => (d === day ? merged : byDay.get(d))).filter(
      (entry): entry is ScheduleEntry => Boolean(entry),
    );

    onChange(next);
  }

  function toggleDay(day: DayOfWeek, enabled: boolean) {
    if (enabled) {
      update(day, { isClosed: false });
      return;
    }

    // Unchecking keeps the row but marks it closed, which is what the API
    // stores for a day the station does not operate.
    update(day, { isClosed: true });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[7rem_auto_1fr_1fr] items-center gap-x-3 text-xs font-medium text-muted-foreground">
        <span>Day</span>
        <span className="sr-only">Open this day</span>
        <span>Opens</span>
        <span>Closes</span>
      </div>

      {DAYS_OF_WEEK.map((day) => {
        const entry = byDay.get(day);
        const isOpen = Boolean(entry) && !entry!.isClosed;
        const inputId = `schedule-${day.toLowerCase()}`;

        return (
          <div key={day} className="grid grid-cols-[7rem_auto_1fr_1fr] items-center gap-x-3">
            <label htmlFor={`${inputId}-enabled`} className="text-sm">
              {day}
            </label>

            <input
              id={`${inputId}-enabled`}
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={isOpen}
              disabled={disabled}
              onChange={(event) => toggleDay(day, event.target.checked)}
              aria-label={`${day}: station is open`}
            />

            <Input
              type="time"
              aria-label={`${day} opening time`}
              value={entry?.openTime ?? ''}
              disabled={disabled || !isOpen}
              onChange={(event) => update(day, { openTime: event.target.value })}
            />

            <Input
              type="time"
              aria-label={`${day} closing time`}
              value={entry?.closeTime ?? ''}
              disabled={disabled || !isOpen}
              onChange={(event) => update(day, { closeTime: event.target.value })}
            />
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Times are the station&apos;s local time. Closing time must be later than
        opening time; the API rejects a window that ends before it starts.
      </p>
    </div>
  );
}
