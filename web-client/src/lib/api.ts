const API_BASE_URL = 'http://localhost:5127/api';

// ─────────────────────────────────────────────────────────────────────────────
// Domain Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Physical time slot at a microgrid hub.
 * Collection: EnergyBookingSlots
 * Relational key: EnergyReservation.slotId → EnergyBookingSlot.id
 */
export interface EnergyBookingSlot {
  id: string;
  /** FK → SolarStationInfo.stationCode (e.g. "CMB-NORTH-01") */
  stationId: string;
  startTime: string; // ISO 8601 UTC
  endTime: string;   // ISO 8601 UTC
  /** Energy capacity of this slot in kWh */
  energyAmountKWh: number;
  /** "Drop-off" | "Charge" */
  actionType: 'Drop-off' | 'Charge';
  /** "Available" | "Booked" | "Maintenance" */
  status: 'Available' | 'Booked' | 'Maintenance';
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Prosumer appointment linked to a physical slot.
 * Collection: EnergyReservations
 * Relational key: EnergyReservation.slotId → EnergyBookingSlot.id
 */
export interface EnergyReservation {
  id: string;
  /** National Identity Card number — primary prosumer identifier */
  prosumerNIC: string;
  /** FK → EnergyBookingSlot.id */
  slotId: string;
  /** "Pending" | "Completed" | "Cancelled" */
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalScheduleBlock {
  startTime: string;
  endTime: string;
  reason: string;
}

/** Microgrid hub station node. Collection: SolarStationInfo */
export interface SolarStation {
  id: string;
  stationCode: string;
  name: string;
  capacityKWh: number;
  totalBatterySlots: number;
  availableBatterySlots: number;
  /** "Active" | "Inactive" | "Maintenance" */
  status: string;
  operationalSchedule: OperationalScheduleBlock[];
}

/** Shape of error responses from the API: { error: string; rule?: string } */
export interface ApiErrorPayload {
  error: string;
  rule?: '7DayRule' | '12HourRule' | 'ValidationError' | 'BusinessRule';
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses API responses. On error, throws an Error with the server's message
 * and attaches `err.rule` for business-rule identification in the UI.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as unknown as T;
    return response.json() as Promise<T>;
  }

  let payload: ApiErrorPayload = { error: `HTTP ${response.status}: ${response.statusText}` };
  try {
    payload = await response.json();
  } catch {
    try { payload.error = await response.text(); } catch { /* keep default */ }
  }

  const err = new Error(payload.error) as Error & { rule?: string };
  err.rule = payload.rule;
  throw err;
}

function authHeaders(userId?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = userId;
  return headers;
}

// ─────────────────────────────────────────────────────────────────────────────
// EnergyBookingSlots  (/api/slots)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSlots = async (): Promise<EnergyBookingSlot[]> => {
  return handleResponse<EnergyBookingSlot[]>(await fetch(`${API_BASE_URL}/slots`));
};

export const fetchSlotsByStation = async (stationId: string): Promise<EnergyBookingSlot[]> => {
  return handleResponse<EnergyBookingSlot[]>(
    await fetch(`${API_BASE_URL}/slots/by-station/${encodeURIComponent(stationId)}`)
  );
};

export const createSlot = async (
  slot: Omit<EnergyBookingSlot, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'updatedByUserId'>,
  userId?: string
): Promise<EnergyBookingSlot> => {
  return handleResponse<EnergyBookingSlot>(
    await fetch(`${API_BASE_URL}/slots`, {
      method: 'POST',
      headers: authHeaders(userId),
      body: JSON.stringify(slot),
    })
  );
};

export const updateSlot = async (
  id: string,
  slot: EnergyBookingSlot,
  userId?: string
): Promise<void> => {
  return handleResponse<void>(
    await fetch(`${API_BASE_URL}/slots/${id}`, {
      method: 'PUT',
      headers: authHeaders(userId),
      body: JSON.stringify(slot),
    })
  );
};

/** Backward-compatibility alias for existing GridOperatorView */
export const updateSlotStatus = updateSlot;

export const deleteSlot = async (id: string): Promise<void> => {
  return handleResponse<void>(
    await fetch(`${API_BASE_URL}/slots/${id}`, { method: 'DELETE' })
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EnergyReservations  (/api/reservations)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchReservations = async (): Promise<EnergyReservation[]> => {
  return handleResponse<EnergyReservation[]>(await fetch(`${API_BASE_URL}/reservations`));
};

export const createReservation = async (
  reservation: Pick<EnergyReservation, 'prosumerNIC' | 'slotId'>,
  userId?: string
): Promise<EnergyReservation> => {
  return handleResponse<EnergyReservation>(
    await fetch(`${API_BASE_URL}/reservations`, {
      method: 'POST',
      headers: authHeaders(userId),
      body: JSON.stringify({ ...reservation, createdByUserId: userId ?? 'anonymous' }),
    })
  );
};

export const updateReservation = async (
  id: string,
  reservation: Partial<EnergyReservation>,
  userId?: string
): Promise<void> => {
  return handleResponse<void>(
    await fetch(`${API_BASE_URL}/reservations/${id}`, {
      method: 'PUT',
      headers: authHeaders(userId),
      body: JSON.stringify(reservation),
    })
  );
};

export const cancelReservation = async (id: string, userId?: string): Promise<void> => {
  return handleResponse<void>(
    await fetch(`${API_BASE_URL}/reservations/${id}`, {
      method: 'DELETE',
      headers: userId ? { 'X-User-Id': userId } : {},
    })
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SolarStations  (/api/stations)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchStations = async (): Promise<SolarStation[]> => {
  return handleResponse<SolarStation[]>(await fetch(`${API_BASE_URL}/stations`));
};

export const fetchStation = async (stationCode: string): Promise<SolarStation> => {
  return handleResponse<SolarStation>(
    await fetch(`${API_BASE_URL}/stations/${encodeURIComponent(stationCode)}`)
  );
};

export const updateStationSlots = async (
  stationCode: string,
  availableBatterySlots: number,
  userId?: string
): Promise<SolarStation> => {
  return handleResponse<SolarStation>(
    await fetch(`${API_BASE_URL}/stations/${encodeURIComponent(stationCode)}/slots`, {
      method: 'PATCH',
      headers: authHeaders(userId),
      body: JSON.stringify({ availableBatterySlots }),
    })
  );
};

export const addMaintenanceBlock = async (
  stationCode: string,
  block: OperationalScheduleBlock,
  userId?: string
): Promise<SolarStation> => {
  return handleResponse<SolarStation>(
    await fetch(`${API_BASE_URL}/stations/${encodeURIComponent(stationCode)}/schedule`, {
      method: 'POST',
      headers: authHeaders(userId),
      body: JSON.stringify(block),
    })
  );
};

export const removeMaintenanceBlock = async (
  stationCode: string,
  index: number
): Promise<SolarStation> => {
  return handleResponse<SolarStation>(
    await fetch(`${API_BASE_URL}/stations/${encodeURIComponent(stationCode)}/schedule/${index}`, {
      method: 'DELETE',
    })
  );
};
