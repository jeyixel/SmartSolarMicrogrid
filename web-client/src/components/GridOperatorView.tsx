import React, { useEffect, useState } from 'react';
import { EnergyBookingSlot, fetchSlots, updateSlotStatus, createSlot } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

export const GridOperatorView: React.FC = () => {
  const [slots, setSlots] = useState<EnergyBookingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSlotStart, setNewSlotStart] = useState('');
  const [newSlotEnd, setNewSlotEnd] = useState('');

  const loadSlots = async () => {
    try {
      const data = await fetchSlots();
      setSlots(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const handleStatusChange = async (slot: EnergyBookingSlot, newStatus: string) => {
    try {
      await updateSlotStatus(slot.id, { ...slot, status: newStatus });
      loadSlots();
    } catch (error) {
      alert('Failed to update slot status');
    }
  };

  const handleCreateSlot = async () => {
    if (!newSlotStart || !newSlotEnd) return;
    try {
      await createSlot({
        gridNodeId: 'NODE-1',
        startTime: new Date(newSlotStart).toISOString(),
        endTime: new Date(newSlotEnd).toISOString(),
        availableCapacity: 100,
        status: 'Available'
      });
      loadSlots();
      setNewSlotStart('');
      setNewSlotEnd('');
    } catch (error) {
      alert('Failed to create slot');
    }
  };

  if (loading) return <div>Loading slots...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Grid Operator Dashboard</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Slot</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div>
            <label className="block text-sm mb-1">Start Time</label>
            <Input type="datetime-local" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">End Time</label>
            <Input type="datetime-local" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} />
          </div>
          <Button onClick={handleCreateSlot}>Create Slot</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slots.map(slot => (
          <Card key={slot.id}>
            <CardHeader>
              <CardTitle>Slot: {new Date(slot.startTime).toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Status:</strong> {slot.status}</p>
              <p><strong>Capacity:</strong> {slot.availableCapacity} kWh</p>
              <div className="mt-4 flex gap-2">
                {slot.status !== 'Maintenance' && (
                  <Button variant="destructive" onClick={() => handleStatusChange(slot, 'Maintenance')}>
                    Set Maintenance
                  </Button>
                )}
                {slot.status === 'Maintenance' && (
                  <Button onClick={() => handleStatusChange(slot, 'Available')}>
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

