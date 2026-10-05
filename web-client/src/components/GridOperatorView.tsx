import React, { useEffect, useState } from 'react';
import { EnergyBookingSlot, fetchSlots, updateSlot, createSlot, StationLookupResponse } from '../lib/api';
import { stationsApi } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Plus, Zap, BatteryCharging } from 'lucide-react';

/**
 * GridOperatorView — manages the EnergyBookingSlots collection.
 * Lets operators create new time slots and toggle slot statuses (Open/Closed).
 */
export const GridOperatorView: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || '';
  const [slots, setSlots]           = useState<EnergyBookingSlot[]>([]);
  const [stations, setStations]     = useState<StationLookupResponse[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);

  // Form state
  const [selectedStationId, setSelectedStationId] = useState('');
  const [newSlotStart, setNewSlotStart]           = useState('');
  const [newSlotEnd, setNewSlotEnd]               = useState('');
  const [newCapacity, setNewCapacity]             = useState('50');
  const [newSlots, setNewSlots]                   = useState('5');
  const [tradeType, setTradeType]                 = useState<'Charging' | 'Discharging' | 'BatterySwap' | 'Drop-off'>('Charging');

  const loadData = async () => {
    try {
      setLoading(true);
      const [slotData, stationLookup] = await Promise.all([
        fetchSlots(),
        stationsApi.lookup().catch(() => []),
      ]);
      setSlots(slotData);
      setStations(stationLookup);
      if (stationLookup.length > 0 && !selectedStationId) {
        setSelectedStationId(stationLookup[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch slots or stations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleStatusChange = async (slot: EnergyBookingSlot, newStatus: EnergyBookingSlot['status']) => {
    try {
      await updateSlot(slot.id, { ...slot, status: newStatus }, userId);
      loadData();
    } catch (error) {
      alert('Failed to update slot status');
    }
  };

  const handleCreateSlot = async () => {
    if (!newSlotStart || !newSlotEnd || !selectedStationId) return;
    const selectedStation = stations.find(s => s.id === selectedStationId);
    setCreating(true);
    try {
      const slotDate = new Date(newSlotStart).toISOString().split('T')[0];
      await createSlot(
        {
          slotCode: `SLOT-${Date.now().toString().slice(-6)}`,
          stationId: selectedStationId,
          stationName: selectedStation ? selectedStation.name : 'Station',
          slotDate,
          startTime: new Date(newSlotStart).toISOString(),
          endTime: new Date(newSlotEnd).toISOString(),
          tradeType,
          totalCapacityKWh: parseFloat(newCapacity) || 50,
          totalBatterySlots: parseInt(newSlots, 10) || 5,
          bookedBatterySlots: 0,
          availableBatterySlots: parseInt(newSlots, 10) || 5,
          status: 'Open',
        },
        userId
      );
      loadData();
      setNewSlotStart('');
      setNewSlotEnd('');
    } catch (error: any) {
      alert(`Failed to create slot: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="text-body-sm text-muted-foreground p-4">Loading slots…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-headline-lg text-foreground">Slot Management</h2>
        <p className="text-body-sm text-muted-foreground mt-0.5">
          Create and manage charging and battery swap time windows at microgrid stations.
        </p>
      </div>

      <Card className="rounded-lg border border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-headline-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Create New Booking Slot
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-label-sm text-slate-700 dark:text-slate-300 block mb-1">Station</label>
            <Select value={selectedStationId} onChange={e => setSelectedStationId(e.target.value)}>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.stationCode}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-label-sm text-slate-700 dark:text-slate-300 block mb-1">Trade Type</label>
            <Select value={tradeType} onChange={e => setTradeType(e.target.value as any)}>
              <option value="Charging">Charging</option>
              <option value="Discharging">Discharging</option>
              <option value="BatterySwap">BatterySwap</option>
              <option value="Drop-off">Drop-off</option>
            </Select>
          </div>
          <div>
            <label className="text-label-sm text-slate-700 dark:text-slate-300 block mb-1">Start Time</label>
            <Input type="datetime-local" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} />
          </div>
          <div>
            <label className="text-label-sm text-slate-700 dark:text-slate-300 block mb-1">End Time</label>
            <Input type="datetime-local" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} />
          </div>
          <div>
            <label className="text-label-sm text-slate-700 dark:text-slate-300 block mb-1">Slots</label>
            <Input type="number" min={1} value={newSlots} onChange={e => setNewSlots(e.target.value)} />
          </div>
          <div>
            <Button
              className="w-full"
              onClick={handleCreateSlot}
              disabled={creating || !newSlotStart || !newSlotEnd || !selectedStationId}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Slot'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slots.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No booking slots found.</p>
        ) : (
          slots.map(slot => (
            <Card key={slot.id} className="rounded-lg border border-border bg-card shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-headline-sm font-mono text-xs flex justify-between items-center">
                  <span>{slot.stationName || slot.stationId}</span>
                  <span className={`px-2 py-0.5 rounded text-label-sm font-semibold uppercase ${
                    slot.status === 'Open' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' :
                    slot.status === 'Full' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' :
                    'bg-muted text-slate-700 dark:text-slate-300 border border-border'
                  }`}>
                    {slot.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground">Trade Type:</span>
                  <span className="font-medium text-foreground">{slot.tradeType}</span>
                </div>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground">Capacity:</span>
                  <span className="font-mono text-foreground">{slot.totalCapacityKWh} kWh</span>
                </div>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground">Available Bays:</span>
                  <span className="font-mono font-medium text-foreground">
                    {slot.availableBatterySlots} / {slot.totalBatterySlots}
                  </span>
                </div>
                <p className="text-body-sm font-mono text-xs text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                  {new Date(slot.startTime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  {' → '}
                  {new Date(slot.endTime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
                <div className="mt-3 flex gap-2 pt-2">
                  {slot.status === 'Open' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleStatusChange(slot, 'Closed')}
                    >
                      Close Slot
                    </Button>
                  ) : slot.status === 'Closed' ? (
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(slot, 'Open')}
                    >
                      Reopen Slot
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
