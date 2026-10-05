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
import { DonutGauge } from '@/components/dashboard/DonutGauge';
import { StatCard } from '@/components/dashboard/StatCard';
import { ErrorAlert } from '@/components/ErrorAlert';
import { StationStatusBadge } from '@/components/StationStatusBadge';
import { Input } from '@/components/ui/input';

/**
 * Grid Operator landing page.
 *
 * Built on the same station list endpoint the Backoffice management screens
 * use (GET /api/stations) - the API does not expose a separate operator feed,
 * so this page fetches every station up to a generous page size and derives
 * its summary numbers, gauge and slot alerts client-side. It links into the
 * existing station detail page for the actions a Grid Operator is actually
 * allowed (updating slots, contact phone and schedule); creating or deleting
 * a station stays Backoffice-only, enforced by the API regardless of what
 * this page shows.
 */

const FETCH_PAGE_SIZE = 100;

/** A station needs attention once fewer than this many slots remain free. */
const LOW_SLOTS_THRESHOLD = 2;

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
    const uptimePct =
      stations.length > 0 ? Math.round((active.length / stations.length) * 100) : 0;

    // Largest nodes first, for the capacity leaderboard.
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
      uptimePct,
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
      {/* Hero band */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 px-6 py-7 text-white shadow-lg">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 animate-drift rounded-full bg-emerald-400/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 animate-drift rounded-full bg-indigo-500/20 blur-3xl"
          style={{ animationDelay: '3s' }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
                Live network status
              </span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Grid Operator Dashboard
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Battery slot availability and node health across the microgrid.
            </p>

            {lastUpdated && (
              <p className="mt-3 font-mono text-[11px] text-slate-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden text-right sm:block">
              <p className="font-display text-3xl font-bold">{summary.uptimePct}%</p>
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Nodes active</p>
            </div>
            <button
              type="button"
              onClick={loadStations}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {error !== null && <ErrorAlert error={error} />}

      {loading ? (
        <SkeletonState />
      ) : (
        <>
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Stations"
              value={summary.totalStations}
              hint="Across the whole network"
              icon={<MapPin className="h-5 w-5" />}
              tone="indigo"
              delayMs={0}
            />
            <StatCard
              label="Active Nodes"
              value={summary.activeCount}
              hint="Serving reservations now"
              icon={<Power className="h-5 w-5" />}
              tone="emerald"
              delayMs={60}
            />
            <StatCard
              label="Battery Slots Free"
              value={
                <>
                  {summary.availableSlots}
                  <span className="text-base font-medium text-slate-400 dark:text-slate-500">
                    {' '}/ {summary.totalSlots}
                  </span>
                </>
              }
              hint="Network-wide capacity"
              icon={<BatteryCharging className="h-5 w-5" />}
              tone="sky"
              delayMs={120}
            />
            <StatCard
              label="Under Maintenance"
              value={summary.maintenanceCount}
              hint="Temporarily out of service"
              icon={<Wrench className="h-5 w-5" />}
              tone="amber"
              delayMs={180}
            />
          </div>

          {/* Gauge + capacity leaderboard */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div
              className="animate-rise-in rounded-xl border border-border bg-card p-5 shadow-sm"
              style={{ animationDelay: '240ms' }}
            >
              <h2 className="text-sm font-semibold text-foreground">Slot Utilization</h2>
              <div className="mt-4 flex flex-col items-center">
                <DonutGauge
                  value={summary.utilizationPct}
                  caption="in use"
                  colorClassName={
                    summary.utilizationPct >= 85
                      ? 'text-rose-500'
                      : summary.utilizationPct >= 60
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                  }
                />
                <div className="mt-4 grid w-full grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-background py-2">
                    <p className="font-display text-lg font-bold text-foreground">
                      {summary.usedSlots}
                    </p>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Occupied</p>
                  </div>
                  <div className="rounded-lg bg-background py-2">
                    <p className="font-display text-lg font-bold text-foreground">
                      {summary.availableSlots}
                    </p>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Free</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="animate-rise-in rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2"
              style={{ animationDelay: '300ms' }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Capacity by Station</h2>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Gauge className="h-3.5 w-3.5" />
                  {summary.totalCapacity.toFixed(1)} kWh total
                </span>
              </div>

              {summary.byCapacity.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">No stations to chart yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {summary.byCapacity.map((station) => {
                    const pct =
                      summary.peakCapacity > 0
                        ? (station.capacityKWh / summary.peakCapacity) * 100
                        : 0;
                    return (
                      <li key={station.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <Link
                            to={`/stations/${encodeURIComponent(station.id)}`}
                            className="truncate font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {station.name}
                          </Link>
                          <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {station.capacityKWh.toFixed(1)} kWh
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-700 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Status split */}
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Power className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Active <strong className="text-foreground">{summary.activeCount}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Maintenance <strong className="text-foreground">{summary.maintenanceCount}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <PowerOff className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  Inactive <strong className="text-foreground">{summary.inactiveCount}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Low battery slot alert */}
          {summary.lowSlotStations.length > 0 && (
            <div
              className="animate-rise-in overflow-hidden rounded-xl border border-amber-200 dark:border-amber-500/30 bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-card shadow-sm"
              style={{ animationDelay: '360ms' }}
            >
              <div className="flex items-start gap-3 p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    {summary.lowSlotStations.length} active station
                    {summary.lowSlotStations.length === 1 ? '' : 's'} running low on battery slots
                  </h2>
                  <ul className="mt-2 divide-y divide-amber-100 dark:divide-amber-500/30">
                    {summary.lowSlotStations.map((station) => (
                      <li
                        key={station.id}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm text-amber-900 dark:text-amber-300"
                      >
                        <span className="truncate">
                          {station.name}{' '}
                          <span className="font-mono text-xs text-amber-700 dark:text-amber-400">
                            {station.stationCode}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-semibold">
                            {station.availableBatterySlots} / {station.totalBatterySlots} free
                          </span>
                          <Link
                            to={`/stations/${encodeURIComponent(station.id)}/edit`}
                            className="rounded-md bg-amber-900/90 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-900"
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
          <div
            className="animate-rise-in overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            style={{ animationDelay: '420ms' }}
          >
            <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h2 className="text-base font-semibold text-foreground">Station Overview</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {visibleStations.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or code…"
                    className="w-full pl-8 sm:w-52"
                    inputSize="sm"
                  />
                </div>
                <div className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="h-8 rounded border border-input bg-card pl-7 pr-2 text-[13px] text-slate-700 dark:text-slate-300 focus:border-primary focus:outline-none"
                    aria-label="Sort stations by"
                  >
                    <option value="name">Name</option>
                    <option value="availableBatterySlots">Slots free</option>
                    <option value="capacityKWh">Capacity</option>
                  </select>
                </div>
                <Link
                  to="/stations"
                  className="whitespace-nowrap text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  Manage all &rarr;
                </Link>
              </div>
            </div>

            {visibleStations.length === 0 ? (
              <div className="p-10 text-center">
                <MapPin className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {stations.length === 0
                    ? 'No stations have been registered yet.'
                    : 'No stations match your search.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-muted-foreground">
                  <thead className="border-b border-border bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-6 py-3">Station</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3">Battery Slots</th>
                      <th scope="col" className="px-6 py-3">Capacity</th>
                      <th scope="col" className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleStations.map((station) => {
                      const low = station.availableBatterySlots <= LOW_SLOTS_THRESHOLD;
                      const freePct =
                        station.totalBatterySlots > 0
                          ? (station.availableBatterySlots / station.totalBatterySlots) * 100
                          : 0;

                      return (
                        <tr key={station.id} className="transition-colors hover:bg-background/80">
                          <td className="px-6 py-3">
                            <div className="font-medium text-foreground">{station.name}</div>
                            <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              {station.stationCode}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <StationStatusBadge status={station.status} />
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  low
                                    ? 'font-semibold text-amber-700 dark:text-amber-400'
                                    : 'font-medium text-slate-700 dark:text-slate-300'
                                }
                              >
                                {station.availableBatterySlots}
                                <span className="text-slate-400 dark:text-slate-500">
                                  /{station.totalBatterySlots}
                                </span>
                              </span>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={
                                    low
                                      ? 'h-full rounded-full bg-amber-500'
                                      : 'h-full rounded-full bg-emerald-500'
                                  }
                                  style={{ width: `${freePct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                              <Gauge className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                              {station.capacityKWh.toFixed(1)} kWh
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Link
                              to={`/stations/${encodeURIComponent(station.id)}`}
                              className="rounded-md px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-800 dark:hover:text-indigo-300"
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

/** Shaped like the loaded page, so the layout does not jump when data lands. */
function SkeletonState() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-6 h-8 w-16 rounded bg-muted" />
            <div className="mt-3 h-2.5 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card lg:col-span-2" />
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
