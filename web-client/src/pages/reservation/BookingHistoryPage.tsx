import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchBookingHistory,
  ReservationHistoryItem,
  HistoryFilterParams,
} from '../../lib/api';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Search,
  Filter,
  RefreshCw,
  Zap,
  BatteryCharging,
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const BookingHistoryPage: React.FC = () => {
  const [prosumerNIC, setProsumerNIC] = useState('');
  const [queryNIC, setQueryNIC] = useState('');
  const [status, setStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState<ReservationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (nicToQuery: string) => {
    if (!nicToQuery.trim()) {
      setHistory([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const filters: HistoryFilterParams = {
        status: status !== 'All' ? status : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        search: searchTerm.trim() || undefined,
      };

      const data = await fetchBookingHistory(nicToQuery.trim(), filters);
      setHistory(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve booking history records.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [status, fromDate, toDate, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQueryNIC(prosumerNIC);
    loadHistory(prosumerNIC);
  };

  useEffect(() => {
    if (queryNIC) {
      loadHistory(queryNIC);
    }
  }, [status, fromDate, toDate, loadHistory, queryNIC]);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    try {
      const s = new Date(startIso);
      const e = new Date(endIso);
      return `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return `${startIso} - ${endIso}`;
    }
  };

  const getStatusBadge = (resStatus: string) => {
    switch (resStatus.toLowerCase()) {
      case 'approved':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {resStatus}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30">
            <XCircle className="w-3.5 h-3.5" />
            {resStatus}
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            {resStatus}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Prosumer Booking History & Telemetry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Query past, current, and filtered energy docking appointments across solar stations.
          </p>
        </div>
        {queryNIC && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadHistory(queryNIC)}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        )}
      </div>

      {/* Search & Criteria Filter Card */}
      <Card className="border border-border shadow-sm bg-card">
        <CardContent className="p-5">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            {/* Primary Search Row */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Enter Prosumer NIC (e.g. 200012345678)..."
                  value={prosumerNIC}
                  onChange={(e) => setProsumerNIC(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-card"
                />
              </div>
              <Button type="submit" disabled={!prosumerNIC.trim() || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Find History
              </Button>
            </div>

            {/* Filter Criteria Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
              {/* Status Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Text Search Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Filter Station/Action
                </label>
                <input
                  type="text"
                  placeholder="Filter station..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Table Card */}
      <Card className="border border-border shadow-sm bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {queryNIC ? `Booking Records for NIC: ${queryNIC}` : 'Enter a NIC to view records'}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {history.length} record{history.length !== 1 ? 's' : ''} found
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-background/75">
              <TableRow>
                <TableHead className="w-[140px]">Booking Ref</TableHead>
                <TableHead>Station Code</TableHead>
                <TableHead>Slot Date & Time</TableHead>
                <TableHead>Capacity (kWh)</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm">Fetching reservation history...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="h-8 w-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                      <span className="text-sm font-medium">
                        {queryNIC ? 'No booking records matched the selected criteria.' : 'Enter a prosumer NIC above to fetch booking history.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                history.map((item) => (
                  <TableRow key={item.id} className="hover:bg-background/50 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {item.id.slice(-8).toUpperCase()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {item.stationName || item.stationId}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-foreground font-medium">
                        {formatDate(item.startTime)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {formatTimeRange(item.startTime, item.endTime)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.energyAmountKWh.toFixed(1)} kWh
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          item.actionType === 'Drop-off'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                            : 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                        }`}
                      >
                        {item.actionType === 'Drop-off' ? (
                          <Zap className="h-3 w-3" />
                        ) : (
                          <BatteryCharging className="h-3 w-3" />
                        )}
                        {item.actionType}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};