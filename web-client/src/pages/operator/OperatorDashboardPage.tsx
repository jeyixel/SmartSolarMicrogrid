import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  BatteryCharging,
  Gauge,
  MapPin,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wrench,
  Zap,
} from 'lucide-react';

import { stationsApi } from '@/api/client';
import type { StationSummary } from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { StationStatusBadge } from '@/components/StationStatusBadge';
import { Input } from '@/components/ui/input';

/**
 * Grid Operator landing page.
 *
 * Built on the same station list endpoint the Backoffice management screens
 * use (GET /api/stations) - the API does not expose a separate operator feed,
 * so this page fetches every station up to a generous page size and derives
 * its summary numbers and slot alerts client-side. It links into the
 * existing station detail page for the actions a Grid Operator is actually
 * allowed (updating slots, contact phone and schedule); creating or deleting
 * a station stays Backoffice-only, enforced by the API regardless of what
 * this page shows.
 */

const FETCH_PAGE_SIZE = 100;

/** A station needs attention once fewer than this many slots remain free. */
const LOW_SLOTS_THRESHOLD = 2;

/**
 * Capacity-by-station bar color. One sequential hue (this portal's emerald
 * accent); the dark step is a level darker, not a reused light-mode hex - the
 * lighter tone fails the dark-surface lightness band.
 * Validated: `node validate_palette.js "#10b981" --mode light` and
 * `"#059669" --mode dark` both pass (dataviz skill, references/color-formula.md).
 */
const CAPACITY_BAR_FILL = 'bg-emerald-500 dark:bg-emerald-600';

type SortKey = 'name' | 'availableBatterySlots' | 'capacityKWh';

export function OperatorDashboardPage() {
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const loadStations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await stationsApi.list({
        page: 1,
        pageSize: FETCH_PAGE_SIZE,
        sortBy: 'name',
        sortDir: 'asc',
      });
      setStations(result.items);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  const summary = useMemo(() => {
    const active = stations.filter((s) => s.status === 'Active');
    const inactive = stations.filter((s) => s.status === 'Inactive');
    const maintenance = stations.filter((s) => s.status === 'Maintenance');
    const totalSlots = stations.reduce((sum, s) => sum + s.totalBatterySlots, 0);
    const availableSlots = stations.reduce((sum, s) => sum + s.availableBatterySlots, 0);
    const totalCapacity = stations.reduce((sum, s) => sum + s.capacityKWh, 0);
    const lowSlotStations = active
      .filter((s) => s.availableBatterySlots <= LOW_SLOTS_THRESHOLD)
      .sort((a, b) => a.availableBatterySlots - b.availableBatterySlots);

    const usedSlots = Math.max(totalSlots - availableSlots, 0);
    const utilizationPct = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

    // Largest nodes first, for the capacity chart.
    const byCapacity = [...stations].sort((a, b) => b.capacityKWh - a.capacityKWh).slice(0, 5);
    const peakCapacity = byCapacity[0]?.capacityKWh ?? 0;

    return {
      totalStations: stations.length,
      activeCount: active.length,
      inactiveCount: inactive.length,
      maintenanceCount: maintenance.length,
      totalSlots,
      availableSlots,
      usedSlots,
      utilizationPct,
      totalCapacity,
      lowSlotStations,
      byCapacity,
      peakCapacity,
    };
  }, [stations]);

  const visibleStations = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? stations.filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.stationCode.toLowerCase().includes(term),
        )
      : stations;

    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'availableBatterySlots') {
        return a.availableBatterySlots - b.availableBatterySlots;
      }
      return b.capacityKWh - a.capacityKWh;
    });
  }, [stations, search, sortKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Grid Operator Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Battery slot availability and node health across the microgrid.
          </p>
          {lastUpdated && (
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={loadStations}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error !== null && <ErrorAlert error={error} />}

      {loading ? (
        <SkeletonState />
      ) : (
        <>
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={<MapPin className="h-4 w-4" />}
              label="Total stations"
              value={summary.totalStations}
              hint="Across the whole network"
              tone="neutral"
            />
            <StatTile
              icon={<Power className="h-4 w-4" />}
              label="Active nodes"
              value={summary.activeCount}
              hint="Serving reservations now"
              tone="emerald"
            />
            <StatTile
              icon={<BatteryCharging className="h-4 w-4" />}
              label="Battery slots free"
              value={`${summary.availableSlots} / ${summary.totalSlots}`}
              hint="Network-wide capacity"
              tone="neutral"
            />
            <StatTile
              icon={<Wrench className="h-4 w-4" />}
              label="Under maintenance"
              value={summary.maintenanceCount}
              hint="Temporarily out of service"
              tone={summary.maintenanceCount > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {/* Slot usage + capacity by station */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Slot usage</h2>

              {/*
                Meter, not a pie: this is a single ratio against a limit
                (occupied / total), and the dataviz skill names a 2-slice pie
                as the wrong form for exactly this shape. Fill carries
                severity (emerald -> amber -> red as usage climbs); the
                unfilled track is a lighter step of the same ramp so state
                reads across the whole bar even before the number is read.
              */}
              <div className="mt-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.utilizationPct}%
                  </span>
                  <span className="text-xs text-muted-foreground">in use</span>
                </div>
                <div className="mt-2 h-4 w-full rounded bg-emerald-100 dark:bg-emerald-500/15">
                  <div
                    className={`h-4 rounded transition-[width] duration-500 ease-out ${
                      summary.utilizationPct >= 85
                        ? 'bg-red-500 dark:bg-red-600'
                        : summary.utilizationPct >= 60
                          ? 'bg-amber-500 dark:bg-amber-600'
                          : 'bg-emerald-500 dark:bg-emerald-600'
                    }`}
                    style={{ width: `${Math.max(summary.utilizationPct, 2)}%` }}
                    role="img"
                    aria-label={`${summary.utilizationPct}% of battery slots in use`}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-md bg-background py-3">
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {summary.usedSlots}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Occupied</p>
                </div>
                <div className="rounded-md bg-background py-3">
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {summary.availableSlots}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Free</p>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {summary.totalSlots} slots total
              </p>
            </div>

            {/*
              Capacity by Station - horizontal bar chart.
              One sequential hue (single series, so no legend - see
              marks-and-anatomy.md); value-at-tip direct labels, which the
              palette validator's light-mode contrast WARN obligates; 24px-cap
              bars with a 4px rounded data-end, 2px gap between bars, growing
              from a single left baseline.
            */}
            <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Capacity by station</h2>
                <span className="text-xs text-muted-foreground">
                  {summary.totalCapacity.toFixed(1)} kWh total
                </span>
              </div>

              {summary.byCapacity.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No stations to chart yet.</p>
              ) : (
                <ul className="mt-5 space-y-3.5" role="img" aria-label="Capacity by station, in kWh">
                  {summary.byCapacity.map((station) => {
                    const pct =
                      summary.peakCapacity > 0
                        ? (station.capacityKWh / summary.peakCapacity) * 100
                        : 0;
                    return (
                      <li key={station.id}>
                        {/*
                          Name sits on its own line, full width - no fixed-width
                          truncating label. A label that doesn't fit gets more
                          room, not clipped (marks-and-anatomy.md).
                        */}
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <Link
                            to={`/stations/${encodeURIComponent(station.id)}`}
                            className="truncate font-medium text-foreground hover:text-primary"
                            title={station.name}
                          >
                            {station.name}
                          </Link>
                          {/* Value at the tip (bars -> value at the tip) */}
                          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {station.capacityKWh.toFixed(1)} kWh
                          </span>
                        </div>
                        <div className="mt-1.5 h-3 rounded bg-muted">
                          <div
                            className={`h-3 rounded-r ${CAPACITY_BAR_FILL} transition-[width] duration-500 ease-out`}
                            style={{
                              width: `${Math.max(pct, 3)}%`,
                              // 4px rounded data-end, square at the baseline (left edge).
                              borderTopLeftRadius: 0,
                              borderBottomLeftRadius: 0,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Status split */}
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Power className="h-3.5 w-3.5" />
                  Active <strong className="text-foreground">{summary.activeCount}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" />
                  Maintenance <strong className="text-foreground">{summary.maintenanceCount}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <PowerOff className="h-3.5 w-3.5" />
                  Inactive <strong className="text-foreground">{summary.inactiveCount}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Low battery slot alert */}
          {summary.lowSlotStations.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
              <div className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    {summary.lowSlotStations.length} active station
                    {summary.lowSlotStations.length === 1 ? '' : 's'} running low on battery slots
                  </h2>
                  <ul className="mt-2 divide-y divide-amber-200/60 dark:divide-amber-500/20">
                    {summary.lowSlotStations.map((station) => (
                      <li
                        key={station.id}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm text-amber-900 dark:text-amber-300"
                      >
                        <span className="truncate">
                          {station.name}{' '}
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            {station.stationCode}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-medium">
                            {station.availableBatterySlots} / {station.totalBatterySlots} free
                          </span>
                          <Link
                            to={`/stations/${encodeURIComponent(station.id)}/edit`}
                            className="rounded-md bg-amber-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-800"
                          >
                            Update slots
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Station overview table */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Station overview</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {visibleStations.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or code…"
                    className="w-full pl-8 sm:w-52"
                    inputSize="sm"
                  />
                </div>
                <div className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="h-8 rounded border border-input bg-card pl-7 pr-2 text-[13px] text-foreground focus:border-primary focus:outline-none"
                    aria-label="Sort stations by"
                  >
                    <option value="name">Name</option>
                    <option value="availableBatterySlots">Slots free</option>
                    <option value="capacityKWh">Capacity</option>
                  </select>
                </div>
                <Link
                  to="/stations"
                  className="whitespace-nowrap text-xs font-medium text-primary hover:underline"
                >
                  Manage all &rarr;
                </Link>
              </div>
            </div>

            {visibleStations.length === 0 ? (
              <div className="p-10 text-center">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground opacity-40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {stations.length === 0
                    ? 'No stations have been registered yet.'
                    : 'No stations match your search.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-6 py-3 font-medium">Station</th>
                      <th scope="col" className="px-6 py-3 font-medium">Status</th>
                      <th scope="col" className="px-6 py-3 font-medium">Battery slots</th>
                      <th scope="col" className="px-6 py-3 font-medium">Capacity</th>
                      <th scope="col" className="px-6 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleStations.map((station) => {
                      const low = station.availableBatterySlots <= LOW_SLOTS_THRESHOLD;

                      return (
                        <tr key={station.id} className="hover:bg-muted/30">
                          <td className="px-6 py-3">
                            <div className="font-medium text-foreground">{station.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {station.stationCode}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <StationStatusBadge status={station.status} />
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={
                                low
                                  ? 'font-semibold text-amber-700 dark:text-amber-400'
                                  : 'text-foreground'
                              }
                            >
                              {station.availableBatterySlots}
                              <span className="text-muted-foreground">
                                /{station.totalBatterySlots}
                              </span>
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Gauge className="h-3.5 w-3.5" />
                              {station.capacityKWh.toFixed(1)} kWh
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Link
                              to={`/stations/${encodeURIComponent(station.id)}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Details
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One KPI tile: icon chip, label, value and a short hint. All four share the
 * same layout; `tone` is reserved for when it carries real meaning (the
 * "good" state, or a warning that something needs attention) - not applied
 * decoratively per-tile. Chip colors reuse the same validated emerald/amber
 * steps as the charts above, not a new ad-hoc palette.
 */
function StatTile({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: 'neutral' | 'emerald' | 'warning';
}) {
  const chipClass =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
        : 'bg-muted text-muted-foreground';

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${chipClass}`}>
          {icon}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p
        className={
          tone === 'warning'
            ? 'mt-3 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400'
            : 'mt-3 text-2xl font-semibold tabular-nums text-foreground'
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Shaped like the loaded page, so the layout does not jump when data lands. */
function SkeletonState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 shrink-0 rounded-md bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
            <div className="mt-3 h-7 w-14 rounded bg-muted" />
            <div className="mt-3 h-2.5 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-56 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-56 animate-pulse rounded-lg border border-border bg-card lg:col-span-2" />
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
    </div>
  );
}
