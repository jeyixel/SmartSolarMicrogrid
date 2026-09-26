import React, { useEffect, useState } from 'react';
import { EnergyBookingSlot, fetchSlots, updateSlot, createSlot } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../contexts/AuthContext';

/**
 * GridOperatorView — manages the EnergyBookingSlots collection.
 * Lets operators create new time slots and toggle maintenance status.
 * Uses updated model fields: stationId, energyAmountKWh, actionType.
 */
export const GridOperatorView: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || '';
  const [slots, setSlots]           = useState<EnergyBookingSlot[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newSlotStart, setNewSlotStart] = useState('');
  const [newSlotEnd, setNewSlotEnd]     = useState('');

  const loadSlots = async () => {
    try {
      setLoading(true);
      const data = await fetchSlots();
      setSlots(data);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSlots(); }, []);

  const handleStatusChange = async (slot: EnergyBookingSlot, newStatus: string) => {
    try {
      await updateSlot(slot.id, { ...slot, status: newStatus as EnergyBookingSlot['status'] }, userId);
      loadSlots();
    } catch (error) {
      alert('Failed to update slot status');
    }
  };

  const handleCreateSlot = async () => {
    if (!newSlotStart || !newSlotEnd) return;
    try {
      await createSlot(
        {
          stationId:       'CMB-NORTH-01',
          startTime:       new Date(newSlotStart).toISOString(),
          endTime:         new Date(newSlotEnd).toISOString(),
          energyAmountKWh: 50,
          actionType:      'Drop-off',
          status:          'Available',
        },
        userId
      );
      loadSlots();
      setNewSlotStart('');
      setNewSlotEnd('');
    } catch (error) {
      alert('Failed to create slot');
    }
  };

  if (loading) return <div className="text-body-sm text-muted-foreground p-4">Loading slots…</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-headline-lg text-slate-900">Slot Management</h2>

      <Card className="rounded-lg border border-slate-200 bg-white shadow-none">
        <CardHeader>
          <CardTitle className="text-headline-sm">Create New Slot</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="text-label-md text-slate-700 block mb-1">Start Time</label>
            <Input type="datetime-local" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} />
          </div>
          <div>
            <label className="text-label-md text-slate-700 block mb-1">End Time</label>
            <Input type="datetime-local" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} />
          </div>
          <Button onClick={handleCreateSlot} disabled={!newSlotStart || !newSlotEnd}>
            Create Slot
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slots.map(slot => (
          <Card key={slot.id} className="rounded-lg border border-slate-200 bg-white shadow-none">
            <CardHeader>
              <CardTitle className="text-headline-sm font-mono text-xs">
                {slot.stationId}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-body-sm">
                <span className="text-muted-foreground">Status:</span>{' '}
                <span className={`font-medium ${slot.status === 'Available' ? 'text-emerald-700' : slot.status === 'Booked' ? 'text-amber-700' : 'text-red-700'}`}>
                  {slot.status}
                </span>
              </p>
              <p className="text-body-sm">
                <span className="text-muted-foreground">Energy:</span>{' '}
                <span className="font-mono">{slot.energyAmountKWh} kWh</span>
              </p>
              <p className="text-body-sm">
                <span className="text-muted-foreground">Type:</span> {slot.actionType}
              </p>
              <p className="text-body-sm font-mono text-xs text-muted-foreground">
                {new Date(slot.startTime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                {' → '}
                {new Date(slot.endTime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              <div className="mt-3 flex gap-2">
                {slot.status !== 'Maintenance' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleStatusChange(slot, 'Maintenance')}
                  >
                    Set Maintenance
                  </Button>
                )}
                {slot.status === 'Maintenance' && (
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange(slot, 'Available')}
                  >
                    Set Available
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
