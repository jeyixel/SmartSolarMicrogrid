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
  slotCode: string;
  stationId: string;
  stationName: string;
  slotDate: string;  // ISO 8601 UTC
  startTime: string; // ISO 8601 UTC
  endTime: string;   // ISO 8601 UTC
  tradeType: 'Charging' | 'Discharging' | 'BatterySwap' | 'Drop-off';
  totalCapacityKWh: number;
  totalBatterySlots: number;
  bookedBatterySlots: number;
  availableBatterySlots: number;
  status: 'Open' | 'Full' | 'Closed' | 'Expired';
  createdByUserId: string;
  updatedByUserId: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/**
 * Prosumer appointment linked to a physical slot.
 * Collection: EnergyReservations
 * Relational key: EnergyReservation.slotId → EnergyBookingSlot.id
 */
export interface EnergyReservation {
  id: string;
  reservationCode: string;
  slotId: string;
  stationId: string;
  stationName: string;
  slotStartTime: string;
  slotEndTime: string;
  prosumerNIC: string;
  prosumerName: string;
  requestedKWh: number;
  status: 'Pending' | 'Approved' | 'CheckedIn' | 'Completed' | 'Cancelled' | 'Rejected';
  qrCodeToken?: string | null;
  qrCodeGeneratedAtUtc?: string | null;
  qrCodeVerifiedAtUtc?: string | null;
  qrCodeVerifiedByUserId?: string | null;
  reservationCreatedAtUtc: string;
  lastModifiedAtUtc: string;
  cancelledAtUtc?: string | null;
  cancelledByUserId?: string | null;
  cancellationReason?: string | null;
  createdByUserId: string;
  updatedByUserId: string;
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
  try {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Ignore sessionStorage error in restricted environments
  }
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
  slot: Omit<EnergyBookingSlot, 'id' | 'createdAtUtc' | 'updatedAtUtc' | 'createdByUserId' | 'updatedByUserId'>,
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

export interface StationLookupResponse {
  id: string;
  stationCode: string;
  name: string;
}

export const fetchStations = async (): Promise<StationLookupResponse[]> => {
  return handleResponse<StationLookupResponse[]>(
    await fetch(`${API_BASE_URL}/stations/lookup`, {
      headers: authHeaders(),
    })
  );
};

export const fetchStationLookup = async (): Promise<StationLookupResponse[]> => {
  return fetchStations();
};

export const fetchStation = async (id: string): Promise<SolarStation> => {
  return handleResponse<SolarStation>(
    await fetch(`${API_BASE_URL}/stations/${encodeURIComponent(id)}`, {
      headers: authHeaders(),
    })
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Statistics (/api/reservations/dashboard/{nic})
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  pendingCount: number;
  upcomingApprovedCount: number;
  totalBookingsCount: number;
}

export const fetchDashboardStats = async (nic: string): Promise<DashboardStats> => {
  return handleResponse<DashboardStats>(
    await fetch(`${API_BASE_URL}/reservations/dashboard/${encodeURIComponent(nic)}`)
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Booking History & Filtering (/api/reservations/history/{nic})
// ─────────────────────────────────────────────────────────────────────────────

export interface ReservationHistoryItem {
  id: string;
  prosumerNIC: string;
  slotId: string;
  stationId: string;
  startTime: string;
  endTime: string;
  energyAmountKWh: number;
  actionType: 'Drop-off' | 'Charge';
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled';
  qrToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryFilterParams {
  status?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export const fetchBookingHistory = async (
  nic: string,
  filters: HistoryFilterParams = {}
): Promise<ReservationHistoryItem[]> => {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== 'All') query.set('status', filters.status);
  if (filters.fromDate) query.set('fromDate', filters.fromDate);
  if (filters.toDate) query.set('toDate', filters.toDate);
  if (filters.search) query.set('search', filters.search);

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return handleResponse<ReservationHistoryItem[]>(
    await fetch(`${API_BASE_URL}/reservations/history/${encodeURIComponent(nic)}${queryString}`)
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QR Code Operations (/api/reservations/{id}/qr)
// ─────────────────────────────────────────────────────────────────────────────

export interface QrCodeDetails {
  reservationId: string;
  reservationCode: string;
  qrCodeToken: string;
  stationId: string;
  stationName: string;
  prosumerNIC: string;
  prosumerName: string;
  slotStartTime: string;
  slotEndTime: string;
  requestedKWh: number;
  actionType: string;
  status: string;
  generatedAtUtc: string;
}

export const generateReservationQr = async (reservationId: string): Promise<QrCodeDetails> => {
  return handleResponse<QrCodeDetails>(
    await fetch(`${API_BASE_URL}/reservations/${encodeURIComponent(reservationId)}/qr`, {
      method: 'POST',
      headers: authHeaders(),
    })
  );
};

export interface EnergyTransferResult {
  success: boolean;
  message: string;
  reservationId: string;
  reservationCode: string;
  prosumerNIC: string;
  prosumerName: string;
  stationId: string;
  stationName: string;
  transferredKWh: number;
  actionType: string;
  previousStatus: string;
  newStatus: string;
  verifiedAtUtc: string;
}

export const verifyAndFinalizeQrTransfer = async (
  qrToken: string,
  operatorUserId?: string,
  stationId?: string
): Promise<EnergyTransferResult> => {
  return handleResponse<EnergyTransferResult>(
    await fetch(`${API_BASE_URL}/reservations/verify-qr`, {
      method: 'POST',
      headers: authHeaders(operatorUserId),
      body: JSON.stringify({ qrToken, operatorUserId, stationId }),
    })
  );
};




