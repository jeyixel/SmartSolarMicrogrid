import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Alert } from '../../components/ui/alert';
import {
  fetchStations,
  createSlot,
  createReservation,
  updateReservation,
  SolarStation,
  EnergyReservation,
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

/**
 * Handles manual creation and modification of reservations on behalf of Prosumers.
 *
 * CREATE flow:
 *   1. Operator fills in Prosumer NIC, Station, Start/End Time, Energy kWh, Action Type.
 *   2. On submit: POST /api/slots  →  POST /api/reservations (with returned slotId).
 *   3. 7-Day Rule violations return HTTP 400 → shown as a prominent toast.
 *
 * EDIT flow:
 *   1. Modal pre-fills with existing reservation's prosumerNIC.
 *   2. On submit: PUT /api/reservations/{id}.
 *   3. 12-Hour Rule violations return HTTP 400 → shown as a prominent toast.
 */
export const ReservationModal: React.FC<ReservationModalProps> = ({
  open,
  onClose,
  onSuccess,
  editReservation,
}) => {
  const { userId } = useAuth();
  const isEdit = !!editReservation;

  // Dropdown data
  const [stations, setStations]   = useState<SolarStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<{ title: string; message: string } | null>(null);

  // ─── Form fields ──────────────────────────────────────────────────────────
  const [prosumerNIC,  setProsumerNIC]  = useState('');
  const [stationCode,  setStationCode]  = useState('');
  const [startTime,    setStartTime]    = useState('');
  const [endTime,      setEndTime]      = useState('');
  const [energyKWh,    setEnergyKWh]    = useState('');
  const [actionType,   setActionType]   = useState<'Drop-off' | 'Charge'>('Drop-off');

  // Load stations whenever modal opens
  useEffect(() => {
    if (!open) return;
    setInlineError(null);
    setStationsLoading(true);

    fetchStations()
      .then(data => {
        setStations(data);
        if (data.length && !stationCode) setStationCode(data[0].stationCode);
      })
      .catch(() =>
        toast({ title: 'Could not load stations', variant: 'warning' })
      )
      .finally(() => setStationsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pre-fill / reset fields based on mode
  useEffect(() => {
    if (isEdit && editReservation) {
      setProsumerNIC(editReservation.prosumerNIC);
    } else {
      setProsumerNIC('');
      setStartTime('');
      setEndTime('');
      setEnergyKWh('');
      setActionType('Drop-off');
    }
    setInlineError(null);
  }, [editReservation, isEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    // Basic client-side validation
    if (!prosumerNIC.trim()) {
      setInlineError({ title: 'Missing field', message: 'Prosumer NIC is required.' });
      return;
    }
    if (!isEdit && (!stationCode || !startTime || !endTime || !energyKWh)) {
      setInlineError({ title: 'Missing fields', message: 'All fields are required to create a reservation.' });
      return;
    }
    if (!isEdit && new Date(endTime) <= new Date(startTime)) {
      setInlineError({ title: 'Invalid times', message: 'End time must be after start time.' });
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && editReservation) {
        // ── EDIT: update prosumerNIC (slot details are immutable after creation)
        await updateReservation(
          editReservation.id,
          { ...editReservation, prosumerNIC },
          userId
        );
        toast({
          title: 'Reservation updated',
          description: `NIC updated to ${prosumerNIC}.`,
          variant: 'default',
        });
      } else {
        // ── CREATE: first create the physical slot, then the reservation
        const slot = await createSlot(
          {
            stationId:       stationCode,
            startTime:       new Date(startTime).toISOString(),
            endTime:         new Date(endTime).toISOString(),
            energyAmountKWh: parseFloat(energyKWh),
            actionType,
            status:          'Available',
          },
          userId
        );

        await createReservation({ prosumerNIC, slotId: slot.id }, userId);
        toast({
          title: 'Reservation created',
          description: `Slot at ${stationCode} booked for ${prosumerNIC}.`,
          variant: 'default',
        });
      }

      onSuccess();
    } catch (err: any) {
      const rule: string | undefined = err.rule;
      const isRule = rule === '7DayRule' || rule === '12HourRule';

      // Show a prominent inline error AND a toast for maximum visibility
      const errorTitle = rule === '7DayRule'
        ? '7-Day Scheduling Rule Violation'
        : rule === '12HourRule'
          ? '12-Hour Modification Rule Violation'
          : 'Operation Failed';

      setInlineError({ title: errorTitle, message: err.message });
      toast({ title: errorTitle, description: err.message, variant: 'destructive' });

      if (isRule) {
        // Don't close the modal — let the operator see the error in context
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
          ? 'Update the prosumer details for this reservation. The slot assignment is locked after creation.'
          : 'Create a new battery slot and assign it to a prosumer.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>

        {/* ── Inline error banner ── */}
        {inlineError && (
          <Alert variant="destructive" title={inlineError.title}>
            {inlineError.message}
          </Alert>
        )}

        {/* ── Prosumer NIC ── */}
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
          <p className="text-body-sm text-muted-foreground mt-0.5">
            National Identity Card number of the solar panel owner.
          </p>
        </div>

        {/* ── CREATE-only fields ── */}
        {!isEdit && (
          <>
            {/* Station selector */}
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
                  value={stationCode}
                  onChange={e => setStationCode(e.target.value)}
                  required
                >
                  {stations.map(s => (
                    <option key={s.stationCode} value={s.stationCode}>
                      {s.stationCode} — {s.name}
                      {' '}({s.availableBatterySlots} slots available)
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label-md text-slate-700 block mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-label-md text-slate-700 block mb-1">
                  End Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Energy + Action */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label-md text-slate-700 block mb-1">
                  Energy Amount (kWh) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="e.g. 25.5"
                  value={energyKWh}
                  onChange={e => setEnergyKWh(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-label-md text-slate-700 block mb-1">
                  Action Type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={actionType}
                  onChange={e => setActionType(e.target.value as 'Drop-off' | 'Charge')}
                  required
                >
                  <option value="Drop-off">Drop-off (Export to Grid)</option>
                  <option value="Charge">Charge (Import from Grid)</option>
                </Select>
              </div>
            </div>

            {/* 7-Day Rule callout */}
            <Alert variant="warning">
              <strong>7-Day Scheduling Rule:</strong> The slot's start time must fall within the
              next 7 days. Slots in the past or more than 7 days away will be rejected by the API.
            </Alert>
          </>
        )}

        {/* EDIT mode: show locked slot context */}
        {isEdit && editReservation && (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Info className="h-3.5 w-3.5" />
              <span className="text-label-md uppercase">Slot details (read-only)</span>
            </div>
            <p className="text-body-sm text-slate-600">
              Slot ID: <span className="font-mono text-xs">{editReservation.slotId}</span>
            </p>
            <p className="text-body-sm text-slate-500 mt-0.5">
              To change the station or time, cancel this reservation and create a new one.
            </p>
            <Alert variant="warning" className="mt-2">
              <strong>12-Hour Modification Rule:</strong> Changes are blocked if the slot
              starts within the next 12 hours.
            </Alert>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Discard
          </Button>
          <Button type="submit" disabled={submitting || stationsLoading}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {isEdit ? 'Saving…' : 'Creating…'}
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Create Reservation'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
