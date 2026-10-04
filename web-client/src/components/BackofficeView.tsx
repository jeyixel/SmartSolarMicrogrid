import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';

import { EnergyReservation, fetchReservations, cancelReservation } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Input } from './ui/input';

/**
 * BackofficeView — "All Reservations": search, filter and manage every
 * reservation in the system.
 *
 * Business rules stay in the API: cancelling calls the reservation service,
 * which enforces the 12-hour rule and returns a message this page shows as-is.
 */

type Status = EnergyReservation['status'];

const STATUSES: Status[] = ['Pending', 'Approved', 'CheckedIn', 'Completed', 'Cancelled', 'Rejected'];

const STATUS_LABELS: Record<Status, string> = {
  Pending: 'Pending',
  Approved: 'Approved',
  CheckedIn: 'Checked in',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Rejected: 'Rejected',
};

const STATUS_STYLES: Record<Status, string> = {
  Pending: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  Approved: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  CheckedIn: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/30',
  Completed: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  Cancelled: 'bg-muted text-muted-foreground border-border',
  Rejected: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
};

/** Only reservations that are still going ahead can be cancelled. */
const CANCELLABLE: Status[] = ['Pending', 'Approved'];

const PAGE_SIZE = 10;

type SortKey = 'newest' | 'oldest' | 'slotSoonest' | 'slotLatest';

export const BackofficeView: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || '';

  const [reservations, setReservations] = useState<EnergyReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');
  const [stationFilter, setStationFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<EnergyReservation | null>(null);
  const [toCancel, setToCancel] = useState<EnergyReservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Load every reservation from the API.
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setReservations(await fetchReservations());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load reservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Any filter change starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, stationFilter, search, sort]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
    for (const r of reservations) {
      if (r.status in result) result[r.status] += 1;
    }
    return result;
  }, [reservations]);

  const stations = useMemo(
    () => Array.from(new Set(reservations.map((r) => r.stationName).filter(Boolean))).sort(),
    [reservations],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = reservations.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (stationFilter !== 'All' && r.stationName !== stationFilter) return false;
      if (!query) return true;
      return [r.reservationCode, r.prosumerNIC, r.prosumerName, r.stationName]
        .some((value) => value?.toLowerCase().includes(query));
    });

    const time = (iso: string) => new Date(iso).getTime() || 0;
    rows.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return time(a.reservationCreatedAtUtc) - time(b.reservationCreatedAtUtc);
        case 'slotSoonest':
          return time(a.slotStartTime) - time(b.slotStartTime);
        case 'slotLatest':
          return time(b.slotStartTime) - time(a.slotStartTime);
        default:
          return time(b.reservationCreatedAtUtc) - time(a.reservationCreatedAtUtc);
      }
    });
    return rows;
  }, [reservations, statusFilter, stationFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstRow = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, filtered.length);

  // Cancel through the API; the service decides whether the 12-hour rule allows it.
  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelReservation(toCancel.id, userId);
      setNotice(`Reservation ${toCancel.reservationCode || toCancel.id} was cancelled.`);
      setToCancel(null);
      setDetail(null);
      await loadData();
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'The reservation could not be cancelled.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">All Reservations</h1>
          <p className="text-sm text-muted-foreground">
            Search, review and manage every energy reservation in the system.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <span>{notice}</span>
          <button
            type="button"
            className="text-xs font-medium underline-offset-2 hover:underline"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status summary — each count is also a filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <StatusTab
          label="All"
          count={reservations.length}
          active={statusFilter === 'All'}
          onClick={() => setStatusFilter('All')}
        />
        {STATUSES.map((status) => (
          <StatusTab
            key={status}
            label={STATUS_LABELS[status]}
            count={counts[status]}
            active={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Search code, prosumer NIC or name, station"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search reservations"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={stationFilter}
          onChange={(event) => setStationFilter(event.target.value)}
          aria-label="Filter by station"
        >
          <option value="All">All stations</option>
          {stations.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Sort reservations"
        >
          <option value="newest">Newest booking first</option>
          <option value="oldest">Oldest booking first</option>
          <option value="slotSoonest">Slot time (soonest)</option>
          <option value="slotLatest">Slot time (latest)</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading reservations…
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-sm">
            <p className="font-medium text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadData()}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <CalendarClock className="mx-auto mb-3 h-8 w-8 opacity-40" aria-hidden="true" />
            <p className="font-medium text-foreground">No reservations found</p>
            <p className="mt-1">
              {reservations.length === 0
                ? 'Nothing has been booked yet.'
                : 'No reservation matches the current filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Reservation</th>
                  <th scope="col" className="px-4 py-3 font-medium">Prosumer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Station</th>
                  <th scope="col" className="px-4 py-3 font-medium">Slot</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Energy</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap font-mono text-xs text-foreground">{r.reservationCode || '—'}</span>
                      <div className="whitespace-nowrap text-xs text-muted-foreground">
                        Booked {formatDate(r.reservationCreatedAtUtc)}
                      </div>
                    </td>
                    <td className="min-w-40 px-4 py-3">
                      <div className="text-foreground">{r.prosumerName || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{r.prosumerNIC}</div>
                    </td>
                    <td className="min-w-44 px-4 py-3 text-foreground">{r.stationName || 'Unknown station'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">
                      {formatSlot(r.slotStartTime, r.slotEndTime)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">
                      {r.requestedKWh.toLocaleString()} kWh
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Details
                        </Button>
                        {CANCELLABLE.includes(r.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setCancelError(null);
                              setToCancel(r);
                            }}
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {firstRow}–{lastRow} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-2 text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Reservation ${detail.reservationCode || ''}` : ''}
        description={detail ? `Booked ${formatDateTime(detail.reservationCreatedAtUtc)}` : undefined}
      >
        {detail && (
          <div className="space-y-5">
            <StatusPill status={detail.status} />
            <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
              <DetailRow label="Prosumer" value={`${detail.prosumerName || 'Unknown'} (${detail.prosumerNIC})`} />
              <DetailRow label="Station" value={detail.stationName || 'Unknown station'} />
              <DetailRow label="Slot" value={formatSlot(detail.slotStartTime, detail.slotEndTime)} />
              <DetailRow label="Energy" value={`${detail.requestedKWh.toLocaleString()} kWh`} />
              <DetailRow
                label="QR pass"
                value={
                  detail.qrCodeVerifiedAtUtc
                    ? `Verified ${formatDateTime(detail.qrCodeVerifiedAtUtc)}`
                    : detail.qrCodeGeneratedAtUtc
                      ? `Issued ${formatDateTime(detail.qrCodeGeneratedAtUtc)}`
                      : 'Not issued'
                }
              />
              <DetailRow label="Last updated" value={formatDateTime(detail.lastModifiedAtUtc)} />
              {detail.status === 'Cancelled' && (
                <DetailRow
                  label="Cancelled"
                  value={[
                    detail.cancelledAtUtc ? formatDateTime(detail.cancelledAtUtc) : null,
                    detail.cancellationReason,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Yes'}
                />
              )}
            </dl>
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              {CANCELLABLE.includes(detail.status) && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setCancelError(null);
                    setToCancel(detail);
                  }}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Cancel reservation
                </Button>
              )}
              <Button onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog
        open={toCancel !== null}
        onClose={() => {
          if (!cancelling) setToCancel(null);
        }}
        title="Cancel this reservation?"
        description={toCancel ? `${toCancel.reservationCode} · ${toCancel.stationName}` : undefined}
      >
        {toCancel && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {toCancel.prosumerName || toCancel.prosumerNIC}'s booking for{' '}
              <span className="text-foreground">{formatSlot(toCancel.slotStartTime, toCancel.slotEndTime)}</span>{' '}
              will be cancelled and its slot released. Reservations starting within 12 hours
              cannot be cancelled.
            </p>
            {cancelError && (
              <p className="rounded-md border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {cancelError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setToCancel(null)} disabled={cancelling}>
                Keep reservation
              </Button>
              <Button variant="destructive" onClick={() => void confirmCancel()} disabled={cancelling}>
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Cancel reservation
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

/** One clickable status count in the summary row. */
function StatusTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? 'opacity-90' : 'text-muted-foreground'}`}>{count}</span>
    </button>
  );
}

/** Status label with its colour. */
function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** One label/value pair in the details dialog. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </>
  );
}

/** "Sat 10 Oct · 13:32 – 14:07"; adds the end date only when the slot spans days. */
function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime())) return '—';

  const day = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (Number.isNaN(end.getTime())) return `${day(start)} · ${time(start)}`;
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${day(start)} · ${time(start)} – ${time(end)}`
    : `${day(start)} ${time(start)} – ${day(end)} ${time(end)}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
