import { useEffect, useState } from 'react';
import { BatteryCharging, Loader2, Minus, Phone, Plus, Save } from 'lucide-react';

import { ApiError, stationsApi } from '@/api/client';
import type { Station, StationSummary, UpdateStationRequest } from '@/api/types';
import { ERROR_CODES } from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StationQuickEditDialogProps {
  /** The row being edited; null closes the dialog. */
  station: StationSummary | null;
  onClose: () => void;
  /** Called with the saved station so the list can refresh. */
  onSaved: (station: Station) => void;
}

/**
 * Grid Operator quick edit: available battery slots and contact phone only.
 *
 * The full station is fetched first and every other field is sent back
 * unchanged, because the update endpoint takes the whole document and the API
 * rejects a Grid Operator who changes any Backoffice-owned field.
 */
export function StationQuickEditDialog({ station, onClose, onSaved }: StationQuickEditDialogProps) {
  const [full, setFull] = useState<Station | null>(null);
  const [available, setAvailable] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const open = station !== null;

  // Load the full station each time the dialog opens for a row.
  useEffect(() => {
    if (!station) return;
    let cancelled = false;

    setFull(null);
    setError(null);
    setSlotError(null);
    setLoading(true);

    stationsApi
      .getById(station.id)
      .then((loaded) => {
        if (cancelled) return;
        setFull(loaded);
        setAvailable(String(loaded.availableBatterySlots));
        setPhone(loaded.contactPhone ?? '');
      })
      .catch((caught) => {
        if (!cancelled) setError(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [station]);

  // Escape closes, unless a save is in flight.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  const total = full?.totalBatterySlots ?? 0;
  const availableNumber = Number(available);
  const availableValid =
    available.trim() !== '' &&
    Number.isInteger(availableNumber) &&
    availableNumber >= 0 &&
    availableNumber <= total;

  const unchanged =
    full !== null &&
    availableNumber === full.availableBatterySlots &&
    phone.trim() === (full.contactPhone ?? '');

  function step(delta: number) {
    const current = Number.isFinite(availableNumber) ? availableNumber : 0;
    setAvailable(String(Math.min(total, Math.max(0, current + delta))));
    setSlotError(null);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!full) return;

    if (!availableValid) {
      setSlotError(`Enter a whole number from 0 to ${total}.`);
      return;
    }

    setSaving(true);
    setError(null);

    const body: UpdateStationRequest = {
      name: full.name,
      description: full.description ?? null,
      addressLine: full.addressLine ?? null,
      latitude: full.latitude,
      longitude: full.longitude,
      capacityKWh: full.capacityKWh,
      totalBatterySlots: full.totalBatterySlots,
      operationalSchedule: full.operationalSchedule,
      // The two fields a Grid Operator may change:
      availableBatterySlots: availableNumber,
      contactPhone: phone.trim() === '' ? null : phone.trim(),
    };

    try {
      const saved = await stationsApi.update(full.id, body);
      onSaved(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.errorCode === ERROR_CODES.SLOT_INVARIANT_VIOLATED) {
        setSlotError(caught.message);
      } else {
        setError(caught);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={station ? `Update ${station.name}` : ''}
      description={station?.stationCode}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading station…
        </div>
      ) : !full ? (
        <div className="space-y-4">
          <ErrorAlert error={error ?? new Error('Station could not be loaded.')} />
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5" noValidate>
          {Boolean(error) && <ErrorAlert error={error} />}

          {/* Available battery slots */}
          <div className="space-y-2">
            <Label htmlFor="quick-available" className="flex items-center gap-2">
              <BatteryCharging className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Available battery slots
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => step(-1)}
                disabled={saving || availableNumber <= 0}
                aria-label="One fewer free slot"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="quick-available"
                inputMode="numeric"
                className="w-20 text-center text-base font-semibold tabular-nums"
                value={available}
                disabled={saving}
                aria-invalid={Boolean(slotError)}
                onChange={(event) => {
                  setAvailable(event.target.value);
                  setSlotError(null);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => step(1)}
                disabled={saving || availableNumber >= total}
                aria-label="One more free slot"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">of {total} free</span>
            </div>

            {/* Visual fill so the change is easy to read at a glance */}
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${total > 0 && availableValid ? (availableNumber / total) * 100 : 0}%` }}
              />
            </div>

            {slotError && <p className="text-sm text-destructive">{slotError}</p>}
          </div>

          {/* Contact phone */}
          <div className="space-y-2">
            <Label htmlFor="quick-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Contact phone
            </Label>
            <Input
              id="quick-phone"
              value={phone}
              disabled={saving}
              placeholder="+94112345678"
              onChange={(event) => setPhone(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Shown to prosumers in the mobile app.</p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            {unchanged && (
              <span className="mr-auto text-xs text-muted-foreground">No changes yet</span>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || unchanged}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Save changes
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
