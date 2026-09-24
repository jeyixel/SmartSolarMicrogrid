import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BatteryCharging,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Power,
  PowerOff,
  Zap,
} from 'lucide-react';

import { stationsApi } from '@/api/client';
import type { DeactivationEligibility, Station } from '@/api/types';
import { DAYS_OF_WEEK } from '@/api/types';
import { DeactivateDialog } from '@/components/DeactivateDialog';
import { ErrorAlert } from '@/components/ErrorAlert';
import { GoogleMapsLinks } from '@/components/GoogleMapsLinks';
import { LocationPicker } from '@/components/LocationPicker';
import { StationStatusBadge } from '@/components/StationStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/context/SessionContext';

export function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isBackoffice, isStaff } = useSession();

  const [station, setStation] = useState<Station | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [eligibility, setEligibility] = useState<DeactivationEligibility | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      setStation(await stationsApi.getById(id));
    } catch (caught) {
      setLoadError(caught);
      setStation(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Ask the API whether deactivation is currently possible, before showing the
   * confirmation. This is the read-only pre-check: it means the operator learns
   * about blocking reservations while deciding, not after committing.
   */
  const openDeactivateDialog = useCallback(async () => {
    if (!id) return;
    setActionError(null);
    setEligibility(null);
    setDialogOpen(true);

    try {
      setEligibility(await stationsApi.deactivationEligibility(id));
    } catch (caught) {
      // The dialog still opens; it shows the failure and disables confirming.
      setActionError(caught);
    }
  }, [id]);

  async function handleDeactivate(reason: string) {
    if (!id) return;
    setWorking(true);
    setActionError(null);
    try {
      setStation(await stationsApi.deactivate(id, reason || undefined));
      setDialogOpen(false);
    } catch (caught) {
      setActionError(caught);
      setDialogOpen(false);
    } finally {
      setWorking(false);
    }
  }

  async function handleActivate() {
    if (!id) return;
    setWorking(true);
    setActionError(null);
    try {
      setStation(await stationsApi.activate(id));
    } catch (caught) {
      setActionError(caught);
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>Loading station…</span>
        </CardContent>
      </Card>
    );
  }

  if (loadError || !station) {
    return (
      <div className="space-y-4">
        <ErrorAlert error={loadError ?? new Error('Station not found.')} />
        <Button variant="outline" onClick={() => navigate('/stations')}>
          <ArrowLeft className="h-4 w-4" />
          Back to stations
        </Button>
      </div>
    );
  }

  const isInactive = station.status === 'Inactive';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/stations')}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to stations</span>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{station.name}</h1>
              <StationStatusBadge status={station.status} />
              {station.status === 'Active' && (
                <span
                  className={
                    station.isOpenNow
                      ? 'text-sm font-medium text-emerald-700'
                      : 'text-sm font-medium text-muted-foreground'
                  }
                >
                  {station.isOpenNow ? 'Open now' : 'Closed now'}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {station.stationCode}
              {station.addressLine ? ` · ${station.addressLine}` : ''}
            </p>
          </div>
        </div>

        {isStaff && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to={`/stations/${station.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>

            {isBackoffice &&
              (isInactive ? (
                <Button onClick={handleActivate} disabled={working}>
                  {working ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                  Reactivate
                </Button>
              ) : (
                <Button variant="destructive" onClick={openDeactivateDialog} disabled={working}>
                  <PowerOff className="h-4 w-4" />
                  Deactivate
                </Button>
              ))}
          </div>
        )}
      </div>

      {Boolean(actionError) && <ErrorAlert error={actionError} />}

      {isInactive && (
        <div className="flex gap-3 rounded-md border border-slate-300 bg-slate-50 p-4 text-sm">
          <PowerOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900">This station is out of service</p>
            <p className="text-slate-700">
              {station.deactivationReason
                ? `Reason: ${station.deactivationReason}`
                : 'No reason was recorded.'}
              {station.deactivatedAtUtc
                ? ` · Deactivated ${formatDateTime(station.deactivatedAtUtc)}`
                : ''}
            </p>
            <p className="mt-1 text-slate-700">
              It is hidden from the mobile app and cannot accept new reservations.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <LocationPicker latitude={station.latitude} longitude={station.longitude} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span className="tabular-nums">
                  {station.latitude.toFixed(6)}, {station.longitude.toFixed(6)}
                </span>
              </p>
              <GoogleMapsLinks
                latitude={station.latitude}
                longitude={station.longitude}
                stationName={station.name}
                showStreetView
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Capacity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Stat
                icon={Zap}
                label="Rated capacity"
                value={`${station.capacityKWh.toLocaleString()} kWh`}
              />
              <Stat
                icon={BatteryCharging}
                label="Battery slots free"
                value={`${station.availableBatterySlots} of ${station.totalBatterySlots}`}
              />
              {station.contactPhone && (
                <Stat icon={Phone} label="Contact" value={station.contactPhone} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Created {formatDateTime(station.createdAtUtc)} by{' '}
                <span className="text-foreground">{station.createdByUserId}</span>
              </p>
              {station.updatedAtUtc && (
                <p>
                  Updated {formatDateTime(station.updatedAtUtc)} by{' '}
                  <span className="text-foreground">{station.updatedByUserId ?? 'unknown'}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Operating hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          {station.operationalSchedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hours recorded — the station is treated as always open.
            </p>
          ) : (
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {DAYS_OF_WEEK.map((day) => {
                const entry = station.operationalSchedule.find((e) => e.dayOfWeek === day);
                return (
                  <div key={day} className="flex justify-between border-b py-1 text-sm">
                    <dt className="text-muted-foreground">{day}</dt>
                    <dd className="tabular-nums">
                      {!entry || entry.isClosed ? (
                        <span className="text-muted-foreground">Closed</span>
                      ) : (
                        `${entry.openTime} – ${entry.closeTime}`
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </CardContent>
      </Card>

      {station.description && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{station.description}</CardContent>
        </Card>
      )}

      <DeactivateDialog
        open={dialogOpen}
        stationName={station.name}
        eligibility={eligibility}
        working={working}
        onCancel={() => setDialogOpen(false)}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
