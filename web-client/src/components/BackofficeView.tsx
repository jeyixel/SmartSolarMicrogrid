import React, { useEffect, useState } from 'react';
import { EnergyReservation, fetchReservations, cancelReservation, EnergyBookingSlot, fetchSlots } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';

export const BackofficeView: React.FC = () => {
  const [reservations, setReservations] = useState<EnergyReservation[]>([]);
  const [slots, setSlots] = useState<Record<string, EnergyBookingSlot>>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [resData, slotsData] = await Promise.all([
        fetchReservations(),
        fetchSlots()
      ]);
      
      const slotsMap: Record<string, EnergyBookingSlot> = {};
      slotsData.forEach(s => slotsMap[s.id] = s);
      
      setSlots(slotsMap);
      setReservations(resData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOverrideCancel = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this reservation?")) return;
    try {
      await cancelReservation(id);
      loadData();
    } catch (error: any) {
      alert(`Failed to cancel: ${error.message}`);
    }
  };

  if (loading) return <div>Loading reservations...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Backoffice System Management</h2>
      <div className="grid grid-cols-1 gap-4">
        {reservations.map(res => {
          const slot = slots[res.slotId];
          return (
            <Card key={res.id}>
              <CardHeader>
                <CardTitle>Reservation: {res.id}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <div>
                  <p><strong>Prosumer NIC:</strong> {res.prosumerId}</p>
                  <p><strong>Status:</strong> {res.status}</p>
                  <p><strong>Created:</strong> {new Date(res.createdAt).toLocaleString()}</p>
                  {slot && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p><strong>Slot Time:</strong> {new Date(slot.startTime).toLocaleString()} - {new Date(slot.endTime).toLocaleString()}</p>
                      <p><strong>Node:</strong> {slot.gridNodeId}</p>
                    </div>
                  )}
                </div>
                {res.status === 'Active' && (
                  <Button variant="destructive" onClick={() => handleOverrideCancel(res.id)}>
                    Override & Cancel
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

