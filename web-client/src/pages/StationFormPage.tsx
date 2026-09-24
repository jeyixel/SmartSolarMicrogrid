import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

import { ApiError, stationsApi } from '@/api/client';
import type { CreateStationRequest, ScheduleEntry, UpdateStationRequest } from '@/api/types';
import { ERROR_CODES } from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { GoogleMapsLinks } from '@/components/GoogleMapsLinks';
import { LocationPicker } from '@/components/LocationPicker';
import { ScheduleEditor } from '@/components/ScheduleEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/context/SessionContext';

/**
 * Form state keeps the numeric fields as strings.
 *
 * A number input bound to a number cannot hold "6." or "-" mid-typing, and
 * coercing early turns an empty field into 0 — which would pass a "capacity is
 * required" check while meaning the opposite. Parsing happens once, on submit.
 */
interface FormState {
  stationCode: string;
  name: string;
  description: string;
  addressLine: string;
  latitude: string;
  longitude: string;
  capacityKWh: string;
  totalBatterySlots: string;
  availableBatterySlots: string;
  contactPhone: string;
  operationalSchedule: ScheduleEntry[];
}

const EMPTY_FORM: FormState = {
  stationCode: '',
  name: '',
  description: '',
  addressLine: '',
  latitude: '',
  longitude: '',
  capacityKWh: '',
  totalBatterySlots: '',
  availableBatterySlots: '',
  contactPhone: '',
  operationalSchedule: [],
};

type LocalErrors = Partial<Record<keyof FormState, string>>;

export function StationFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isBackoffice } = useSession();

  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState<LocalErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Load the station being edited.
  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    stationsApi
      .getById(id)
      .then((station) => {
        if (cancelled) return;
        setForm({
          stationCode: station.stationCode,
          name: station.name,
          description: station.description ?? '',
          addressLine: station.addressLine ?? '',
          latitude: String(station.latitude),
          longitude: String(station.longitude),
          capacityKWh: String(station.capacityKWh),
          totalBatterySlots: String(station.totalBatterySlots),
          availableBatterySlots: String(station.availableBatterySlots),
          contactPhone: station.contactPhone ?? '',
          operationalSchedule: station.operationalSchedule ?? [],
        });
      })
      .catch((caught) => {
        if (!cancelled) setSubmitError(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setLocalErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const handleLocationChange = useCallback(
    (lat: number, lng: number) => {
      set('latitude', String(lat));
      set('longitude', String(lng));
    },
    [set],
  );

  const pinLatitude = useMemo(() => toFiniteNumber(form.latitude), [form.latitude]);
  const pinLongitude = useMemo(() => toFiniteNumber(form.longitude), [form.longitude]);

  /**
   * Mirrors the server's field rules so the obvious mistakes are caught without
   * a round trip. The server validates independently — this is a convenience,
   * never the enforcement.
   */
  function validate(): LocalErrors {
    const errors: LocalErrors = {};

    if (!isEdit) {
      const code = form.stationCode.trim();
      if (!code) {
        errors.stationCode = 'Station code is required.';
      } else if (code.length < 3 || code.length > 20) {
        errors.stationCode = 'Station code must be between 3 and 20 characters.';
      } else if (!/^[A-Za-z0-9-]+$/.test(code)) {
        errors.stationCode = 'Use only letters, digits and hyphens.';
      }
    }

    const name = form.name.trim();
    if (!name) {
      errors.name = 'Name is required.';
    } else if (name.length < 3 || name.length > 100) {
      errors.name = 'Name must be between 3 and 100 characters.';
    }

    const lat = toFiniteNumber(form.latitude);
    if (lat === null) {
      errors.latitude = 'Latitude is required.';
    } else if (lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be between -90 and 90.';
    }

    const lng = toFiniteNumber(form.longitude);
    if (lng === null) {
      errors.longitude = 'Longitude is required.';
    } else if (lng < -180 || lng > 180) {
      errors.longitude = 'Longitude must be between -180 and 180.';
    }

    // The API rejects (0, 0) as an unset position rather than as a point in the
    // Gulf of Guinea, so say that here rather than letting the save fail.
    if (lat === 0 && lng === 0) {
      errors.latitude = 'Set the station position — (0, 0) is not a valid location.';
    }

    const capacity = toFiniteNumber(form.capacityKWh);
    if (capacity === null) {
      errors.capacityKWh = 'Capacity is required.';
    } else if (capacity <= 0) {
      errors.capacityKWh = 'Capacity must be greater than 0.';
    } else if (capacity > 100000) {
      errors.capacityKWh = 'Capacity must be at most 100000 kWh.';
    }

    const total = toFiniteNumber(form.totalBatterySlots);
    if (total === null) {
      errors.totalBatterySlots = 'Total battery slots is required.';
    } else if (!Number.isInteger(total) || total < 1 || total > 1000) {
      errors.totalBatterySlots = 'Total battery slots must be a whole number between 1 and 1000.';
    }

    const available = toFiniteNumber(form.availableBatterySlots);
    if (available === null) {
      errors.availableBatterySlots = 'Available battery slots is required.';
    } else if (!Number.isInteger(available) || available < 0) {
      errors.availableBatterySlots = 'Available battery slots must be 0 or greater.';
    } else if (total !== null && available > total) {
      errors.availableBatterySlots = 'Available slots cannot exceed total slots.';
    }

    for (const entry of form.operationalSchedule) {
      if (entry.isClosed) continue;
      if (!entry.openTime || !entry.closeTime) {
        errors.operationalSchedule = `Set both opening and closing times for ${entry.dayOfWeek}.`;
        break;
      }
      if (entry.closeTime <= entry.openTime) {
        errors.operationalSchedule = `Closing time must be later than opening time for ${entry.dayOfWeek}.`;
        break;
      }
    }

    return errors;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const errors = validate();
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError(null);
      return;
    }

    setSaving(true);
    setSubmitError(null);

    const shared = {
      name: form.name.trim(),
      description: emptyToNull(form.description),
      addressLine: emptyToNull(form.addressLine),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      capacityKWh: Number(form.capacityKWh),
      totalBatterySlots: Number(form.totalBatterySlots),
      availableBatterySlots: Number(form.availableBatterySlots),
      contactPhone: emptyToNull(form.contactPhone),
      operationalSchedule: form.operationalSchedule,
    };

    try {
      if (isEdit && id) {
        // stationCode and status are deliberately absent: the code is immutable
        // and the status changes only through the deactivate/activate actions.
        await stationsApi.update(id, shared as UpdateStationRequest);
        navigate(`/stations/${id}`);
      } else {
        const created = await stationsApi.create({
          ...shared,
          stationCode: form.stationCode.trim().toUpperCase(),
        } as CreateStationRequest);
        navigate(`/stations/${created.id}`);
      }
    } catch (caught) {
      setSubmitError(caught);

      // Attach server-side field messages to the inputs that produced them, so
      // the operator does not have to map a list of errors back onto the form.
      if (caught instanceof ApiError) {
        const fieldErrors = caught.fieldErrors;
        if (fieldErrors) {
          const mapped: LocalErrors = {};
          for (const [field, messages] of Object.entries(fieldErrors)) {
            const key = field.split('.')[0].replace(/\[\d+\]$/, '') as keyof FormState;
            if (key in EMPTY_FORM) mapped[key] = messages[0];
          }
          setLocalErrors(mapped);
        } else if (caught.errorCode === ERROR_CODES.DUPLICATE_STATION_CODE) {
          setLocalErrors({ stationCode: caught.message });
        } else if (caught.errorCode === ERROR_CODES.SLOT_INVARIANT_VIOLATED) {
          setLocalErrors({ availableBatterySlots: caught.message });
        }
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  if (!isBackoffice && !isEdit) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <p>Registering a station is a Backoffice operation.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/stations')}>
            Back to stations
          </Button>
        </CardContent>
      </Card>
    );
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? 'Edit station' : 'Register station'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? 'Update the node’s details, position, capacity and operating hours.'
              : 'Add a new solar grid hub to the microgrid.'}
          </p>
        </div>
      </div>

      {Boolean(submitError) && <ErrorAlert error={submitError} />}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            {isEdit
              ? 'The station code is fixed once a station exists — it appears on labels and in support calls.'
              : 'The station code is permanent, so choose something operators can read aloud.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="stationCode"
            label="Station code"
            required={!isEdit}
            error={localErrors.stationCode}
            hint={isEdit ? 'Cannot be changed after creation.' : 'For example, CMB-NORTH-01.'}
          >
            <Input
              id="stationCode"
              value={form.stationCode}
              disabled={isEdit}
              aria-invalid={Boolean(localErrors.stationCode)}
              onChange={(event) => set('stationCode', event.target.value.toUpperCase())}
              placeholder="CMB-NORTH-01"
            />
          </Field>

          <Field id="name" label="Station name" required error={localErrors.name}>
            <Input
              id="name"
              value={form.name}
              aria-invalid={Boolean(localErrors.name)}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Colombo North Solar Hub"
            />
          </Field>

          <Field id="addressLine" label="Address" error={localErrors.addressLine}>
            <Input
              id="addressLine"
              value={form.addressLine}
              onChange={(event) => set('addressLine', event.target.value)}
              placeholder="45 Galle Road, Colombo 03"
            />
          </Field>

          <Field id="contactPhone" label="Contact phone" error={localErrors.contactPhone}>
            <Input
              id="contactPhone"
              value={form.contactPhone}
              onChange={(event) => set('contactPhone', event.target.value)}
              placeholder="+94112345678"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field id="description" label="Description" error={localErrors.description}>
              <Input
                id="description"
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="Rooftop array, Block B"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            The Android app plots these coordinates on the map, so they should be
            the position a prosumer would drive to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="latitude" label="Latitude" required error={localErrors.latitude}>
              <Input
                id="latitude"
                inputMode="decimal"
                value={form.latitude}
                aria-invalid={Boolean(localErrors.latitude)}
                onChange={(event) => set('latitude', event.target.value)}
                placeholder="6.927079"
              />
            </Field>

            <Field id="longitude" label="Longitude" required error={localErrors.longitude}>
              <Input
                id="longitude"
                inputMode="decimal"
                value={form.longitude}
                aria-invalid={Boolean(localErrors.longitude)}
                onChange={(event) => set('longitude', event.target.value)}
                placeholder="79.861244"
              />
            </Field>
          </div>

          <LocationPicker
            latitude={pinLatitude}
            longitude={pinLongitude}
            onChange={handleLocationChange}
          />

          {/*
            Only once a pin exists. Checking the position against Google's
            imagery is the quickest way to catch a transposed latitude and
            longitude, which otherwise looks plausible until the map loads.
          */}
          {pinLatitude !== null && pinLongitude !== null && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Verify this position:</span>
              <GoogleMapsLinks
                latitude={pinLatitude}
                longitude={pinLongitude}
                stationName={form.name || undefined}
                showStreetView
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacity and storage</CardTitle>
          <CardDescription>
            Available slots track how many battery bays are free right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field id="capacityKWh" label="Capacity (kWh)" required error={localErrors.capacityKWh}>
            <Input
              id="capacityKWh"
              inputMode="decimal"
              value={form.capacityKWh}
              aria-invalid={Boolean(localErrors.capacityKWh)}
              onChange={(event) => set('capacityKWh', event.target.value)}
              placeholder="250.5"
            />
          </Field>

          <Field
            id="totalBatterySlots"
            label="Total battery slots"
            required
            error={localErrors.totalBatterySlots}
          >
            <Input
              id="totalBatterySlots"
              inputMode="numeric"
              value={form.totalBatterySlots}
              aria-invalid={Boolean(localErrors.totalBatterySlots)}
              onChange={(event) => set('totalBatterySlots', event.target.value)}
              placeholder="20"
            />
          </Field>

          <Field
            id="availableBatterySlots"
            label="Available slots"
            required
            error={localErrors.availableBatterySlots}
          >
            <Input
              id="availableBatterySlots"
              inputMode="numeric"
              value={form.availableBatterySlots}
              aria-invalid={Boolean(localErrors.availableBatterySlots)}
              onChange={(event) => set('availableBatterySlots', event.target.value)}
              placeholder="7"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operating hours</CardTitle>
          <CardDescription>
            Used to tell the mobile app whether a station is open right now.
            Leave every day unchecked if the node runs continuously.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScheduleEditor
            value={form.operationalSchedule}
            onChange={(next) => set('operationalSchedule', next)}
          />
          {localErrors.operationalSchedule && (
            <p className="text-sm text-destructive">{localErrors.operationalSchedule}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isEdit ? 'Save changes' : 'Register station'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Returns null for blank or non-numeric input, so "missing" stays distinct from 0. */
function toFiniteNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
