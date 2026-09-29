/**
 * Mirrors the Member 2 station API contract.
 *
 * These types are the web client's half of the agreement with the backend; if
 * an endpoint's shape changes, this file changes with it. Nothing here talks to
 * MongoDB — the browser only ever sees what the REST API chooses to return.
 */

export type StationStatus = 'Active' | 'Inactive' | 'Maintenance';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface ScheduleEntry {
  dayOfWeek: DayOfWeek;
  openTime: string; // "HH:mm", station-local
  closeTime: string; // "HH:mm", station-local
  isClosed: boolean;
}

/** Full document, including audit fields. Backoffice and Grid Operator only. */
export interface Station {
  id: string;
  stationCode: string;
  name: string;
  description?: string | null;
  addressLine?: string | null;
  latitude: number;
  longitude: number;
  capacityKWh: number;
  totalBatterySlots: number;
  availableBatterySlots: number;
  status: StationStatus;
  operationalSchedule: ScheduleEntry[];
  contactPhone?: string | null;
  isOpenNow: boolean;
  createdAtUtc: string;
  createdByUserId: string;
  updatedAtUtc?: string | null;
  updatedByUserId?: string | null;
  deactivatedAtUtc?: string | null;
  deactivationReason?: string | null;
}

/** One row of the management list. */
export interface StationSummary {
  id: string;
  stationCode: string;
  name: string;
  latitude: number;
  longitude: number;
  capacityKWh: number;
  totalBatterySlots: number;
  availableBatterySlots: number;
  status: StationStatus;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface CreateStationRequest {
  stationCode: string;
  name: string;
  description?: string | null;
  addressLine?: string | null;
  latitude: number;
  longitude: number;
  capacityKWh: number;
  totalBatterySlots: number;
  availableBatterySlots: number;
  status?: StationStatus;
  operationalSchedule?: ScheduleEntry[];
  contactPhone?: string | null;
}

/**
 * Note the absences: `stationCode` is immutable after creation and `status`
 * changes only through the deactivate/activate endpoints, so neither is part of
 * an ordinary update.
 */
export interface UpdateStationRequest {
  name: string;
  description?: string | null;
  addressLine?: string | null;
  latitude: number;
  longitude: number;
  capacityKWh: number;
  totalBatterySlots: number;
  availableBatterySlots: number;
  operationalSchedule?: ScheduleEntry[];
  contactPhone?: string | null;
}

/** Answer to "may this station be deactivated right now?" */
export interface DeactivationEligibility {
  stationId: string;
  canDeactivate: boolean;
  activeReservationCount: number;
  reason?: string | null;
}

export interface StationListQuery {
  status?: StationStatus | '';
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'createdAtUtc' | 'stationCode';
  sortDir?: 'asc' | 'desc';
}

/** The error envelope every non-2xx response from the station API uses. */
export interface ApiErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  details?: unknown;
  traceId?: string;
  timestamp?: string;
}

/** Field-level failures arrive as a map of field name to messages. */
export type FieldErrors = Record<string, string[]>;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  STATION_NOT_FOUND: 'STATION_NOT_FOUND',
  DUPLICATE_STATION_CODE: 'DUPLICATE_STATION_CODE',
  STATION_CODE_IMMUTABLE: 'STATION_CODE_IMMUTABLE',
  SLOT_INVARIANT_VIOLATED: 'SLOT_INVARIANT_VIOLATED',
  INVALID_SCHEDULE: 'INVALID_SCHEDULE',
  STATION_ALREADY_INACTIVE: 'STATION_ALREADY_INACTIVE',
  STATION_ALREADY_ACTIVE: 'STATION_ALREADY_ACTIVE',
  STATION_HAS_ACTIVE_RESERVATIONS: 'STATION_HAS_ACTIVE_RESERVATIONS',
  RESERVATION_SERVICE_UNAVAILABLE: 'RESERVATION_SERVICE_UNAVAILABLE',
  FORBIDDEN_OPERATION: 'FORBIDDEN_OPERATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Details carried by a blocked deactivation, so the count can be shown. */
export interface ActiveReservationDetails {
  stationId: string;
  activeReservationCount: number;
}

export type UserRole = 'Backoffice' | 'GridOperator' | 'Prosumer';

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'Backoffice', label: 'Backoffice' },
  { value: 'GridOperator', label: 'Grid Operator' },
  { value: 'Prosumer', label: 'Prosumer' },
];
