import React, { useEffect, useState } from 'react';
import {
  EnergyReservation,
  EnergyBookingSlot,
  fetchReservations,
  fetchSlots,
  cancelReservation,
} from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';

/**
 * BackofficeView — read-only overview of all reservations with admin override cancel.
 * Uses updated model fields: prosumerNIC (was prosumerId), stationId (was gridNodeId).
 */
export const BackofficeView: React.FC = () => {
  const { userId } = useAuth();
  const [reservations, setReservations] = useState<EnergyReservation[]>([]);
  const [slots, setSlots]               = useState<Record<string, EnergyBookingSlot>>({});
  const [loading, setLoading]           = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resData, slotsData] = await Promise.all([
        fetchReservations(),
        fetchSlots(),
      ]);
      const slotsMap: Record<string, EnergyBookingSlot> = {};
      slotsData.forEach(s => { slotsMap[s.id] = s; });
      setSlots(slotsMap);
      setReservations(resData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleOverrideCancel = async (id: string) => {
    if (!window.confirm('Override and cancel this reservation?')) return;
    try {
      await cancelReservation(id, userId);
      loadData();
    } catch (error: any) {
      alert(`Failed to cancel: ${error.message}`);
    }
  };

  if (loading) return <div className="text-body-sm text-muted-foreground p-4">Loading reservations…</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-headline-lg text-slate-900">System Overview</h2>
      <div className="grid grid-cols-1 gap-4">
        {reservations.length === 0 && (
          <p className="text-body-sm text-muted-foreground">No reservations in the system.</p>
        )}
        {reservations.map(res => {
          const slot = slots[res.slotId];
          return (
            <Card key={res.id} className="rounded-lg border border-slate-200 bg-white shadow-none">
              <CardHeader>
                <CardTitle className="text-headline-sm font-mono text-xs">{res.id}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-start flex-wrap gap-4">
                <div className="space-y-0.5">
                  <p className="text-body-sm">
                    <span className="text-muted-foreground">Prosumer NIC:</span>{' '}
                    <span className="font-mono text-xs font-medium">{res.prosumerNIC}</span>
                  </p>
                  <p className="text-body-sm">
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <span className={`font-medium ${res.status === 'Pending' ? 'text-amber-700' : res.status === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {res.status}
                    </span>
                  </p>
                  <p className="text-body-sm text-muted-foreground">
                    Created: {new Date(res.createdAt).toLocaleString()}
                  </p>
                  {slot && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-body-sm space-y-0.5">
                      <p>
                        <span className="text-muted-foreground">Station:</span>{' '}
                        <span className="font-mono text-xs">{slot.stationId}</span>
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {new Date(slot.startTime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        {' → '}
                        {new Date(slot.endTime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  )}
                </div>
                {res.status === 'Pending' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleOverrideCancel(res.id)}
                  >
                    Override &amp; Cancel
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
