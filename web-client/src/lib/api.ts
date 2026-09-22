const API_BASE_URL = 'http://localhost:5127/api';

export interface EnergyBookingSlot {
  id: string;
  gridNodeId: string;
  startTime: string;
  endTime: string;
  availableCapacity: number;
  status: string; // Available, Booked, Maintenance
}

export interface EnergyReservation {
  id: string;
  slotId: string;
  prosumerId: string;
  status: string; // Active, Cancelled, Completed
  createdAt: string;
}

export const fetchSlots = async (): Promise<EnergyBookingSlot[]> => {
  const response = await fetch(`${API_BASE_URL}/slots`);
  if (!response.ok) throw new Error('Failed to fetch slots');
  return response.json();
};

export const createSlot = async (slot: Omit<EnergyBookingSlot, 'id'>): Promise<EnergyBookingSlot> => {
  const response = await fetch(`${API_BASE_URL}/slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slot),
  });
  if (!response.ok) throw new Error('Failed to create slot');
  return response.json();
};

export const updateSlotStatus = async (id: string, slot: EnergyBookingSlot): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/slots/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slot),
  });
  if (!response.ok) throw new Error('Failed to update slot');
};

export const fetchReservations = async (): Promise<EnergyReservation[]> => {
  const response = await fetch(`${API_BASE_URL}/reservations`);
  if (!response.ok) throw new Error('Failed to fetch reservations');
  return response.json();
};

export const createReservation = async (reservation: Omit<EnergyReservation, 'id' | 'createdAt' | 'status'>): Promise<EnergyReservation> => {
  const response = await fetch(`${API_BASE_URL}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservation),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to create reservation');
  }
  return response.json();
};

export const cancelReservation = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to cancel reservation');
  }
};
