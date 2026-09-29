import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Alert } from '../../components/ui/alert';
import {
  fetchStations,
  fetchSlotsByStation,
  createReservation,
  updateReservation,
  StationLookupResponse,
  EnergyReservation,
  EnergyBookingSlot
} from '../../lib/api';
import { toast } from '../../hooks/useToast';
import { Loader2, Info } from 'lucide-react';

interface ReservationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When provided, the modal operates in Edit mode; otherwise Create mode. */
  editReservation?: EnergyReservation;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  open,
  onClose,
  onSuccess,
  editReservation,
}) => {
  const { user } = useAuth();
  const userId = user?.id || '';
  const isEdit = !!editReservation;

  // Dropdown data
  const [stations, setStations] = useState<StationLookupResponse[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  
  const [slots, setSlots] = useState<EnergyBookingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<{ title: string; message: string } | null>(null);

  // Form fields
  const [prosumerNIC, setProsumerNIC] = useState('');
  const [stationId, setStationId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [requestedKWh, setRequestedKWh] = useState('');

  // Load stations whenever modal opens
  useEffect(() => {
    if (!open) return;
    setInlineError(null);
    setStationsLoading(true);

    fetchStations()
      .then(data => {
        setStations(data);
        if (data.length && !stationId) setStationId(data[0].id);
      })
      .catch(() =>
        toast({ title: 'Could not load stations', variant: 'warning' })
      )
      .finally(() => setStationsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load slots when station changes
  useEffect(() => {
    if (!stationId || !open) return;
    setSlotsLoading(true);
    setSlotId(''); // reset slot

    fetchSlotsByStation(stationId)
      .then(data => {
        // Only show Open slots with available capacity
        const openSlots = data.filter(s => s.status === 'Open' && s.availableBatterySlots > 0);
        setSlots(openSlots);
        if (openSlots.length > 0) setSlotId(openSlots[0].id);
      })
      .catch(() =>
        toast({ title: 'Could not load slots', variant: 'warning' })
      )
      .finally(() => setSlotsLoading(false));
  }, [stationId, open]);

  // Pre-fill / reset fields based on mode
  useEffect(() => {
    if (isEdit && editReservation) {
      setProsumerNIC(editReservation.prosumerNIC);
      setStationId(editReservation.stationId);
      setSlotId(editReservation.slotId);
      setRequestedKWh(editReservation.requestedKWh?.toString() || '');
    } else {
      setProsumerNIC('');
      setRequestedKWh('');
      // stationId and slotId are set by their respective useEffects
    }
    setInlineError(null);
  }, [editReservation, isEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    if (!prosumerNIC.trim()) {
      setInlineError({ title: 'Missing field', message: 'Prosumer NIC is required.' });
      return;
    }
    if (!slotId) {
      setInlineError({ title: 'Missing field', message: 'Please select an open booking slot.' });
      return;
    }
    if (!requestedKWh) {
      setInlineError({ title: 'Missing field', message: 'Requested kWh is required.' });
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && editReservation) {
        await updateReservation(
          editReservation.id,
          { 
            prosumerNIC,
            slotId,
            requestedKWh: parseFloat(requestedKWh)
          },
          userId
        );
        toast({
          title: 'Reservation updated',
          description: `Updated reservation for ${prosumerNIC}.`,
          variant: 'default',
        });
      } else {
        await createReservation({ 
          prosumerNIC, 
          slotId,
          requestedKWh: parseFloat(requestedKWh)
        } as any, userId);
        
        toast({
          title: 'Reservation created',
          description: `Slot booked for ${prosumerNIC}.`,
          variant: 'default',
        });
      }

      onSuccess();
    } catch (err: any) {
      const rule: string | undefined = err.rule;
      const isRule = rule === '7DayRule' || rule === '12HourRule';

      const errorTitle = rule === '7DayRule'
        ? '7-Day Scheduling Rule Violation'
        : rule === '12HourRule'
          ? '12-Hour Modification Rule Violation'
          : 'Operation Failed';

      setInlineError({ title: errorTitle, message: err.message });
      toast({ title: errorTitle, description: err.message, variant: 'destructive' });

      if (isRule) {
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Reservation' : 'New Reservation'}
      description={
        isEdit
          ? 'Update the reservation details.'
          : 'Assign an open battery slot to a prosumer.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>

        {inlineError && (
          <Alert variant="destructive" title={inlineError.title}>
            {inlineError.message}
          </Alert>
        )}

        <div>
          <label className="text-label-md text-slate-700 block mb-1">
            Prosumer NIC <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="e.g. 980123456V"
            value={prosumerNIC}
            onChange={e => setProsumerNIC(e.target.value)}
            required
            aria-required="true"
          />
        </div>

        <div>
          <label className="text-label-md text-slate-700 block mb-1">
            Requested Energy (kWh) <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            min="0.1"
            step="0.1"
            placeholder="e.g. 25.5"
            value={requestedKWh}
            onChange={e => setRequestedKWh(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-label-md text-slate-700 block mb-1">
            Microgrid Station <span className="text-red-500">*</span>
          </label>
          {stationsLoading ? (
            <div className="flex items-center gap-2 h-9 text-muted-foreground text-body-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stations…
            </div>
          ) : (
            <Select
              value={stationId}
              onChange={e => setStationId(e.target.value)}
              required
            >
              {stations.map(s => (
                <option key={s.id} value={s.id}>
                  {s.stationCode} — {s.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <label className="text-label-md text-slate-700 block mb-1">
            Booking Slot <span className="text-red-500">*</span>
          </label>
          {slotsLoading ? (
            <div className="flex items-center gap-2 h-9 text-muted-foreground text-body-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading open slots…
            </div>
          ) : (
            <Select
              value={slotId}
              onChange={e => setSlotId(e.target.value)}
              required
              disabled={slots.length === 0}
            >
              {slots.length === 0 ? (
                <option value="">No available slots found</option>
              ) : (
                slots.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.startTime).toLocaleString()} - {new Date(s.endTime).toLocaleTimeString()} ({s.availableBatterySlots} bays open)
                  </option>
                ))
              )}
            </Select>
          )}
        </div>

        <Alert variant="warning">
          <strong>Rules:</strong> Slots must start within the next 7 days. Changes/Cancellations are blocked if starting within 12 hours.
        </Alert>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Discard
          </Button>
          <Button type="submit" disabled={submitting || stationsLoading || slotsLoading || !slotId}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Reservation'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
