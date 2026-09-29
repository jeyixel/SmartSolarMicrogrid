import { useEffect, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2, PowerOff } from 'lucide-react';

import type { DeactivationEligibility } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeactivateDialogProps {
  open: boolean;
  stationName: string;
  /** Null while the pre-check is still running, or if it failed. */
  eligibility: DeactivationEligibility | null;
  working: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Confirmation for taking a station out of service.
 *
 * The dialog runs on the result of the read-only eligibility check, so an
 * operator sees blocking reservations while deciding rather than after
 * committing. Confirming is disabled when the API says the station cannot be
 * deactivated — but that is a courtesy, not the enforcement: the deactivate
 * endpoint re-checks and is the thing that actually refuses.
 */
export function DeactivateDialog({
  open,
  stationName,
  eligibility,
  working,
  onCancel,
  onConfirm,
}: DeactivateDialogProps) {
  const [reason, setReason] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const reasonRef = useRef<HTMLInputElement | null>(null);

  // Reset between openings, so a previous reason is not silently reused.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  // Escape closes, and focus moves into the dialog when it opens.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !working) onCancel();
    }

    document.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => reasonRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, working, onCancel]);

  if (!open) return null;

  const checking = eligibility === null;
  const blocked = eligibility !== null && !eligibility.canDeactivate;
  const count = eligibility?.activeReservationCount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        // Only a click on the backdrop itself dismisses; a drag that ends
        // outside the dialog should not.
        if (event.target === event.currentTarget && !working) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deactivate-title"
        aria-describedby="deactivate-description"
        className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2 text-destructive">
            <PowerOff className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="deactivate-title" className="text-lg font-semibold">
              Deactivate {stationName}?
            </h2>
            <p id="deactivate-description" className="mt-1 text-sm text-muted-foreground">
              The station will stop appearing in the mobile app and will not accept
              new reservations. You can reactivate it later.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {checking ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking for active reservations…
            </div>
          ) : blocked ? (
            <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  {count > 0
                    ? `${count} active reservation${count === 1 ? '' : 's'} block this`
                    : 'This station cannot be deactivated'}
                </p>
                <p>
                  {eligibility?.reason
                    ?? 'Wait for the reservations to complete or be cancelled, then try again.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                No active reservations are associated with this station, so it can be
                taken out of service.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="deactivation-reason">Reason (optional)</Label>
            <Input
              id="deactivation-reason"
              ref={reasonRef}
              value={reason}
              maxLength={250}
              disabled={working || blocked}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Inverter replacement"
            />
            <p className="text-xs text-muted-foreground">
              Recorded against the station so the next operator knows why it is offline.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={working}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason.trim())}
            disabled={working || checking || blocked}
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PowerOff className="h-4 w-4" aria-hidden="true" />
            )}
            Deactivate station
          </Button>
        </div>
      </div>
    </div>
  );
}
