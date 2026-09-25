import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchStations,
  updateStationSlots,
  addMaintenanceBlock,
  removeMaintenanceBlock,
  SolarStation,
} from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Alert } from '../../components/ui/alert';
import { toast } from '../../hooks/useToast';
import {
  BatteryCharging,
  CalendarOff,
  RefreshCw,
  Trash2,
  Loader2,
  AlertTriangle,
  MapPin,
  Zap,
} from 'lucide-react';

// ─── Station status chip ──────────────────────────────────────────────────────
const StationStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Active:      'bg-emerald-50 text-emerald-700 border-emerald-200',
    Inactive:    'bg-slate-100  text-slate-600   border-slate-200',
    Maintenance: 'bg-amber-50   text-amber-700   border-amber-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-label-sm uppercase font-mono ${styles[status] ?? styles.Inactive}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500 animate-pulse' : status === 'Maintenance' ? 'bg-amber-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
};

/**
 * StationScheduleManager
 *
 * Allows Grid Operators to manage the physical realities of microgrid nodes:
 *   1. Select a station node from the dropdown.
 *   2. Override its availableBatterySlots count (PATCH /api/stations/{code}/slots).
 *   3. Add maintenance/operational blackout blocks (POST /api/stations/{code}/schedule).
 *   4. Remove existing blocks (DELETE /api/stations/{code}/schedule/{index}).
 */
export const StationScheduleManager: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || '';

  const [stations,      setStations]      = useState<SolarStation[]>([]);
  const [selectedCode,  setSelectedCode]  = useState<string>('');
  const [station,       setStation]       = useState<SolarStation | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);

  // Battery slots override
  const [slotsOverride, setSlotsOverride] = useState('');

  // Maintenance block form
  const [blockStart,    setBlockStart]    = useState('');
  const [blockEnd,      setBlockEnd]      = useState('');
  const [blockReason,   setBlockReason]   = useState('');

  const loadStations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStations();
      setStations(data);
      if (data.length && !selectedCode) {
        setSelectedCode(data[0].stationCode);
      }
    } catch (err: any) {
      toast({ title: 'Failed to load stations', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadStations(); }, [loadStations]);

  // Keep local station object in sync with selected code
  useEffect(() => {
    const found = stations.find(s => s.stationCode === selectedCode) ?? null;
    setStation(found);
    setSlotsOverride(found ? String(found.availableBatterySlots) : '');
  }, [selectedCode, stations]);

  // ─── Battery slots override ───────────────────────────────────────────────
  const handleSlotsUpdate = async () => {
    if (!station) return;
    const val = parseInt(slotsOverride, 10);

    if (isNaN(val) || val < 0) {
      toast({ title: 'Invalid value', description: 'Slot count must be 0 or greater.', variant: 'destructive' });
      return;
    }
    if (val > station.totalBatterySlots) {
      toast({
        title: 'Exceeds capacity',
        description: `Maximum is ${station.totalBatterySlots} (total battery slots).`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateStationSlots(station.stationCode, val, userId);
      // Merge update back into local state
      setStations(prev => prev.map(s => s.stationCode === updated.stationCode ? updated : s));
      setStation(updated);
      toast({ title: 'Battery slots updated', description: `${updated.stationCode} → ${val} available slots.`, variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Add maintenance block ────────────────────────────────────────────────
  const handleAddBlock = async () => {
    if (!station) return;

    if (!blockStart || !blockEnd || !blockReason.trim()) {
      toast({ title: 'Missing fields', description: 'Start time, end time, and reason are all required.', variant: 'destructive' });
      return;
    }
    if (new Date(blockEnd) <= new Date(blockStart)) {
      toast({ title: 'Invalid time range', description: 'End time must be after start time.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const updated = await addMaintenanceBlock(
        station.stationCode,
        {
          startTime: new Date(blockStart).toISOString(),
          endTime:   new Date(blockEnd).toISOString(),
          reason:    blockReason.trim(),
        },
        userId
      );
      setStations(prev => prev.map(s => s.stationCode === updated.stationCode ? updated : s));
      setStation(updated);
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      toast({ title: 'Maintenance block added', description: `Scheduled on ${updated.stationCode}.`, variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Failed to add block', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Remove maintenance block ─────────────────────────────────────────────
  const handleRemoveBlock = async (index: number) => {
    if (!station) return;
    if (!window.confirm('Remove this maintenance block?')) return;

    setSaving(true);
    try {
      const updated = await removeMaintenanceBlock(station.stationCode, index);
      setStations(prev => prev.map(s => s.stationCode === updated.stationCode ? updated : s));
      setStation(updated);
      toast({ title: 'Block removed', variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Failed to remove block', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-body-md">Loading stations…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-headline-lg text-slate-900">Station Schedule Manager</h2>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Override battery slot availability and manage operational maintenance windows
            for microgrid hub nodes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStations} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Station selector */}
      <Card className="rounded-lg border border-slate-200 bg-white shadow-none">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-headline-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Select Microgrid Node
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {stations.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">No stations available.</p>
          ) : (
            <>
              <Select
                value={selectedCode}
                onChange={e => setSelectedCode(e.target.value)}
                className="max-w-sm"
              >
                {stations.map(s => (
                  <option key={s.stationCode} value={s.stationCode}>
                    {s.stationCode} — {s.name}
                  </option>
                ))}
              </Select>

              {/* Station stats row */}
              {station && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Station Code', value: station.stationCode, mono: true },
                    { label: 'Capacity',     value: `${station.capacityKWh} kWh`, mono: true },
                    { label: 'Total Slots',  value: String(station.totalBatterySlots), mono: true },
                    { label: 'Status',       value: <StationStatusBadge status={station.status} /> },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="bg-slate-50 rounded border border-slate-200 px-3 py-2">
                      <p className="text-label-sm text-muted-foreground uppercase mb-0.5">{label}</p>
                      {typeof value === 'string'
                        ? <p className={`text-telemetry-md text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
                        : value}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {station && (
        <>
          {/* ── Battery Slots Override ── */}
          <Card className="rounded-lg border border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-headline-sm flex items-center gap-2">
                <BatteryCharging className="h-4 w-4 text-primary" />
                Override Available Battery Slots
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-xs">
                  <label className="text-label-md text-slate-700 block mb-1">
                    Available Slots
                    <span className="text-muted-foreground ml-1.5">
                      (max: <span className="font-mono">{station.totalBatterySlots}</span>)
                    </span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={station.totalBatterySlots}
                    value={slotsOverride}
                    onChange={e => setSlotsOverride(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSlotsUpdate}
                  disabled={saving || slotsOverride === String(station.availableBatterySlots)}
                >
                  {saving
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
                    : 'Apply Override'}
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-body-sm text-muted-foreground">
                  Current available: <span className="font-mono text-slate-900">{station.availableBatterySlots}</span>
                  {' / '}
                  <span className="font-mono text-slate-900">{station.totalBatterySlots}</span> total
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Operational Schedule ── */}
          <Card className="rounded-lg border border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-headline-sm flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-primary" />
                Operational Schedule — Maintenance Blocks
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">

              {/* Existing blocks list */}
              {station.operationalSchedule.length === 0 ? (
                <p className="text-body-sm text-muted-foreground py-1">
                  No maintenance blocks currently scheduled for {station.stationCode}.
                </p>
              ) : (
                <div className="space-y-2">
                  {station.operationalSchedule.map((block, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                          <span className="text-body-md text-amber-900 font-medium">{block.reason}</span>
                        </div>
                        <p className="text-body-sm text-amber-700 font-mono mt-0.5">
                          {new Date(block.startTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                          {' → '}
                          {new Date(block.endTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0"
                        onClick={() => handleRemoveBlock(idx)}
                        disabled={saving}
                        aria-label={`Remove block: ${block.reason}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new block form */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-label-md text-slate-700 mb-3 uppercase">
                  Add New Maintenance Block
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-body-sm text-muted-foreground block mb-1">Start Time</label>
                    <Input
                      type="datetime-local"
                      value={blockStart}
                      onChange={e => setBlockStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-body-sm text-muted-foreground block mb-1">End Time</label>
                    <Input
                      type="datetime-local"
                      value={blockEnd}
                      onChange={e => setBlockEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Input
                    placeholder="Reason (e.g. Scheduled battery calibration)"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    className="flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddBlock(); } }}
                  />
                  <Button
                    onClick={handleAddBlock}
                    disabled={saving || !blockStart || !blockEnd || !blockReason.trim()}
                  >
                    {saving
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : 'Add Block'}
                  </Button>
                </div>
                <Alert variant="default" className="mt-3">
                  Maintenance blocks are informational — they do not automatically block new bookings.
                  Operators should manually set station status to "Maintenance" during outages.
                </Alert>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
