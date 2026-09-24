import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Map, MapPin, Plus, Search } from 'lucide-react';

import { stationsApi } from '@/api/client';
import type { PagedResponse, StationListQuery, StationStatus, StationSummary } from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { StationStatusBadge } from '@/components/StationStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSession } from '@/context/SessionContext';
import { googleMapsPlaceUrl } from '@/lib/maps';

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: StationStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Maintenance', label: 'Maintenance' },
];

export function StationListPage() {
  const navigate = useNavigate();
  const { isBackoffice, isStaff } = useSession();

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<StationListQuery>({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: 'name',
    sortDir: 'asc',
    status: '',
    search: '',
  });

  const [data, setData] = useState<PagedResponse<StationSummary> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 },
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await stationsApi.list(query));
    } catch (caught) {
      setError(caught);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.page ?? query.page ?? 1;

  const rangeLabel = useMemo(() => {
    if (!data || data.totalCount === 0) return null;
    const first = (data.page - 1) * data.pageSize + 1;
    const last = Math.min(data.page * data.pageSize, data.totalCount);
    return `${first}–${last} of ${data.totalCount}`;
  }, [data]);

  if (!isStaff) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <p>The station management list is available to Backoffice and Grid Operator roles.</p>
          <p className="mt-1 text-sm">Switch role in the header to view it.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Microgrid nodes</h1>
          <p className="text-sm text-muted-foreground">
            Register, configure and manage solar grid hubs.
          </p>
        </div>

        {isBackoffice && (
          <Button onClick={() => navigate('/stations/new')}>
            <Plus className="h-4 w-4" />
            Register station
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="relative min-w-60 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Search by name or station code"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search stations"
            />
          </div>

          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={query.status ?? ''}
            onChange={(event) =>
              setQuery((prev) => ({
                ...prev,
                status: event.target.value as StationStatus | '',
                page: 1,
              }))
            }
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={`${query.sortBy}:${query.sortDir}`}
            onChange={(event) => {
              const [sortBy, sortDir] = event.target.value.split(':');
              setQuery((prev) => ({
                ...prev,
                sortBy: sortBy as StationListQuery['sortBy'],
                sortDir: sortDir as StationListQuery['sortDir'],
                page: 1,
              }));
            }}
            aria-label="Sort stations"
          >
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
            <option value="stationCode:asc">Station code</option>
            <option value="createdAtUtc:desc">Newest first</option>
            <option value="createdAtUtc:asc">Oldest first</option>
          </select>
        </CardContent>
      </Card>

      {Boolean(error) && <ErrorAlert error={error} />}

      <Card>
        {loading ? (
          <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Loading stations…</span>
          </CardContent>
        ) : !data || data.items.length === 0 ? (
          <CardContent className="py-16 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-8 w-8 opacity-40" aria-hidden="true" />
            <p className="font-medium text-foreground">No stations found</p>
            <p className="mt-1 text-sm">
              {query.search || query.status
                ? 'No station matches the current filters.'
                : 'Register the first microgrid node to get started.'}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Registered microgrid nodes, {rangeLabel ?? ''}
              </caption>
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Station</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Capacity</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Slots free</th>
                  <th scope="col" className="px-4 py-3 font-medium">Location</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((station) => (
                  <tr key={station.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        to={`/stations/${station.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {station.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{station.stationCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StationStatusBadge status={station.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {station.capacityKWh.toLocaleString()} kWh
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {station.availableBatterySlots} / {station.totalBatterySlots}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">
                          {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                        </span>
                        <a
                          href={googleMapsPlaceUrl(station.latitude, station.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                          title="Open in Google Maps"
                          aria-label={`Open ${station.name} in Google Maps (opens in a new tab)`}
                        >
                          <Map className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/stations/${station.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalCount > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">{rangeLabel}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setQuery((prev) => ({ ...prev, page: currentPage - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-2 text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setQuery((prev) => ({ ...prev, page: currentPage + 1 }))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
