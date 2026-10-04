import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { stationsApi } from '@/api/client';
import type {
  Station,
  StationLookupResponse,
  ScheduleEntry,
  DayOfWeek,
  UpdateStationRequest,
} from '@/api/types';
import { DAYS_OF_WEEK } from '@/api/types';
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
  MapPin,
  Zap,
  Lock,
  Plus,
  Clock,
} from 'lucide-react';

// ─── Station status chip ──────────────────────────────────────────────────────
const StationStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Active:      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    Inactive:    'bg-muted  text-muted-foreground   border-border',
    Maintenance: 'bg-amber-50 dark:bg-amber-500/10   text-amber-700 dark:text-amber-400   border-amber-200 dark:border-amber-500/30',
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
 * Separation of Duties:
 *   - Available Battery Slots: Editable by Grid Operators (and Backoffice) via PUT /api/stations/{id}.
 *   - Operational Schedules: Maintained by Backoffice. Read-only for Grid Operators.
 */
export const StationScheduleManager: React.FC = () => {
  const { user } = useAuth();
  const isBackoffice = user?.role === 0;

  const [stations,       setStations]       = useState<StationLookupResponse[]>([]);
  const [selectedId,     setSelectedId]     = useState<string>('');
  const [station,        setStation]        = useState<Station | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [stationLoading, setStationLoading] = useState(false);
  const [saving,         setSaving]         = useState(false);

  // Battery slots override
  const [slotsOverride, setSlotsOverride] = useState('');

  // Schedule entry form (Backoffice only)
  const [newDay,       setNewDay]       = useState<DayOfWeek>('Monday');
  const [newOpenTime,  setNewOpenTime]  = useState('06:00');
  const [newCloseTime, setNewCloseTime] = useState('20:00');
  const [newIsClosed,  setNewIsClosed]  = useState(false);

  const loadStationDetails = useCallback(async (id: string) => {
    if (!id) return;
    setStationLoading(true);
    try {
      const data = await stationsApi.getById(id);
      setStation(data);
      setSlotsOverride(String(data.availableBatterySlots));
    } catch (err: any) {
      toast({ title: 'Failed to load station details', description: err.message, variant: 'destructive' });
    } finally {
      setStationLoading(false);
    }
  }, []);

  const loadStations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stationsApi.lookup();
      setStations(data);
      if (data.length > 0) {
        const targetId = selectedId && data.some(s => s.id === selectedId) ? selectedId : data[0].id;
        setSelectedId(targetId);
        await loadStationDetails(targetId);
      } else {
        setStation(null);
      }
    } catch (err: any) {
      toast({ title: 'Failed to load stations', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loadStationDetails, selectedId]);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  const handleStationChange = (id: string) => {
    setSelectedId(id);
    loadStationDetails(id);
  };

  // ─── Battery slots override (PUT /api/stations/{id}) ─────────────────────
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
      const updatePayload: UpdateStationRequest = {
        stationCode: station.stationCode,
        name: station.name,
        description: station.description,
        addressLine: station.addressLine,
        latitude: station.latitude,
        longitude: station.longitude,
        capacityKWh: station.capacityKWh,
        totalBatterySlots: station.totalBatterySlots,
        availableBatterySlots: val,
        operationalSchedule: station.operationalSchedule,
        contactPhone: station.contactPhone,
      };

      const updated = await stationsApi.update(station.id, updatePayload);
      setStation(updated);
      setSlotsOverride(String(updated.availableBatterySlots));
      toast({
        title: 'Battery slots updated',
        description: `${updated.stationCode} → ${val} available slots.`,
        variant: 'default',
      });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Add/Update schedule entry (Backoffice only) ─────────────────────────
  const handleAddScheduleEntry = async () => {
    if (!station) return;
    if (!isBackoffice) {
      toast({ title: 'Access Denied', description: 'Only Backoffice administrators may modify operational schedules.', variant: 'destructive' });
      return;
    }

    if (!newIsClosed && (!newOpenTime || !newCloseTime)) {
      toast({ title: 'Missing fields', description: 'Opening and closing times are required.', variant: 'destructive' });
      return;
    }

    if (!newIsClosed && newCloseTime <= newOpenTime) {
      toast({ title: 'Invalid hours', description: 'Closing time must be later than opening time.', variant: 'destructive' });
      return;
    }

    const existingIndex = (station.operationalSchedule ?? []).findIndex(
      e => e.dayOfWeek.toLowerCase() === newDay.toLowerCase()
    );

    const newEntry: ScheduleEntry = {
      dayOfWeek: newDay,
      openTime: newIsClosed ? '00:00' : newOpenTime,
      closeTime: newIsClosed ? '00:01' : newCloseTime,
      isClosed: newIsClosed,
    };

    let nextSchedule: ScheduleEntry[];
    if (existingIndex >= 0) {
      nextSchedule = [...(station.operationalSchedule ?? [])];
      nextSchedule[existingIndex] = newEntry;
    } else {
      nextSchedule = [...(station.operationalSchedule ?? []), newEntry];
    }

    setSaving(true);
    try {
      const updatePayload: UpdateStationRequest = {
        stationCode: station.stationCode,
        name: station.name,
        description: station.description,
        addressLine: station.addressLine,
        latitude: station.latitude,
        longitude: station.longitude,
        capacityKWh: station.capacityKWh,
        totalBatterySlots: station.totalBatterySlots,
        availableBatterySlots: station.availableBatterySlots,
        operationalSchedule: nextSchedule,
        contactPhone: station.contactPhone,
      };

      const updated = await stationsApi.update(station.id, updatePayload);
      setStation(updated);
      toast({ title: 'Schedule updated', description: `Saved operational window for ${newDay}.`, variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Failed to update schedule', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Remove schedule entry (Backoffice only) ─────────────────────────────
  const handleRemoveScheduleEntry = async (index: number) => {
    if (!station) return;
    if (!isBackoffice) {
      toast({ title: 'Access Denied', description: 'Only Backoffice administrators may modify operational schedules.', variant: 'destructive' });
      return;
    }
    if (!window.confirm('Remove this schedule entry?')) return;

    setSaving(true);
    try {
      const nextSchedule = [...(station.operationalSchedule ?? [])];
      nextSchedule.splice(index, 1);

      const updatePayload: UpdateStationRequest = {
        stationCode: station.stationCode,
        name: station.name,
        description: station.description,
        addressLine: station.addressLine,
        latitude: station.latitude,
        longitude: station.longitude,
        capacityKWh: station.capacityKWh,
        totalBatterySlots: station.totalBatterySlots,
        availableBatterySlots: station.availableBatterySlots,
        operationalSchedule: nextSchedule,
        contactPhone: station.contactPhone,
      };

      const updated = await stationsApi.update(station.id, updatePayload);
      setStation(updated);
      toast({ title: 'Schedule entry removed', variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Failed to remove schedule entry', description: err.message, variant: 'destructive' });
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
          <h2 className="text-headline-lg text-foreground">Station Schedule &amp; Slots Manager</h2>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Manage real-time available battery slots and view or maintain operational hours.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStations} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Station selector */}
      <Card className="rounded-lg border border-border bg-card shadow-none">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-headline-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Select Microgrid Node
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {stations.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">No active stations available.</p>
          ) : (
            <>
              <Select
                value={selectedId}
                onChange={e => handleStationChange(e.target.value)}
                className="max-w-sm"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.stationCode} — {s.name}
                  </option>
                ))}
              </Select>

              {/* Station stats row */}
              {stationLoading ? (
                <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading node details…
                </div>
              ) : station && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Station Code', value: station.stationCode, mono: true },
                    { label: 'Capacity',     value: `${station.capacityKWh} kWh`, mono: true },
                    { label: 'Total Slots',  value: String(station.totalBatterySlots), mono: true },
                    { label: 'Status',       value: <StationStatusBadge status={station.status} /> },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="bg-background rounded border border-border px-3 py-2">
                      <p className="text-label-sm text-muted-foreground uppercase mb-0.5">{label}</p>
                      {typeof value === 'string'
                        ? <p className={`text-telemetry-md text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
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
          <Card className="rounded-lg border border-border bg-card shadow-none">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-headline-sm flex items-center gap-2">
                <BatteryCharging className="h-4 w-4 text-primary" />
                Override Available Battery Slots
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-xs">
                  <label className="text-label-md text-slate-700 dark:text-slate-300 block mb-1">
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
                  Current available: <span className="font-mono text-foreground">{station.availableBatterySlots}</span>
                  {' / '}
                  <span className="font-mono text-foreground">{station.totalBatterySlots}</span> total
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Operational Schedule ── */}
          <Card className="rounded-lg border border-border bg-card shadow-none">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-headline-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarOff className="h-4 w-4 text-primary" />
                  Operational Schedule
                </span>
                {!isBackoffice && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                    <Lock className="h-3.5 w-3.5" />
                    Read-only (Backoffice managed)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {!isBackoffice && (
                <Alert variant="default" className="text-sm text-slate-700 dark:text-slate-300">
                  <Lock className="h-4 w-4 inline mr-1 text-slate-500 dark:text-slate-400" />
                  Operational schedules are maintained by the <strong>Backoffice</strong> team. Grid Operators have read-only visibility.
                </Alert>
              )}

              {/* Existing schedule entries list */}
              {(!station.operationalSchedule || station.operationalSchedule.length === 0) ? (
                <p className="text-body-sm text-muted-foreground py-1">
                  No operating hours recorded for {station.stationCode}.
                </p>
              ) : (
                <div className="space-y-2">
                  {station.operationalSchedule.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border border-border bg-background px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-body-md text-foreground font-medium">
                            {entry.dayOfWeek}
                          </p>
                          <p className="text-body-sm font-mono text-muted-foreground mt-0.5">
                            {entry.isClosed ? (
                              <span className="text-amber-700 dark:text-amber-400 font-medium">Closed all day</span>
                            ) : (
                              `${entry.openTime} → ${entry.closeTime}`
                            )}
                          </p>
                        </div>
                      </div>
                      {isBackoffice && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 w-7 p-0 flex-shrink-0"
                          onClick={() => handleRemoveScheduleEntry(idx)}
                          disabled={saving}
                          aria-label={`Remove schedule for ${entry.dayOfWeek}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add/update schedule window form (Backoffice only) */}
              {isBackoffice && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-label-md text-slate-700 dark:text-slate-300 mb-3 uppercase">
                    Add or Update Operating Hours
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3 items-end">
                    <div>
                      <label className="text-body-sm text-muted-foreground block mb-1">Day of Week</label>
                      <Select
                        value={newDay}
                        onChange={e => setNewDay(e.target.value as DayOfWeek)}
                      >
                        {DAYS_OF_WEEK.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-body-sm text-muted-foreground block mb-1">Opens (HH:mm)</label>
                      <Input
                        type="time"
                        value={newOpenTime}
                        onChange={e => setNewOpenTime(e.target.value)}
                        disabled={newIsClosed}
                      />
                    </div>
                    <div>
                      <label className="text-body-sm text-muted-foreground block mb-1">Closes (HH:mm)</label>
                      <Input
                        type="time"
                        value={newCloseTime}
                        onChange={e => setNewCloseTime(e.target.value)}
                        disabled={newIsClosed}
                      />
                    </div>
                    <div className="flex items-center gap-2 h-10">
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newIsClosed}
                          onChange={e => setNewIsClosed(e.target.checked)}
                          className="rounded border-input"
                        />
                        Closed all day
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleAddScheduleEntry} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Save Hours
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
