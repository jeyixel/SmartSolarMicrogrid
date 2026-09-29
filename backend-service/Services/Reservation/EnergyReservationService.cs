using backend_service.Data;
using backend_service.Models;

namespace backend_service.Services;

/// <summary>
/// FAT service implementing all reservation business logic.
/// The two core rules applied here:
///
///   7-Day Scheduling Rule (CreateReservationAsync):
///     A reservation can only be created if the linked EnergyBookingSlot's StartTime
///     falls within the next 7 days (not in the past, not more than 7 days ahead).
///
///   12-Hour Modification/Cancellation Rule (UpdateReservationAsync / CancelReservationAsync):
///     Modifications and cancellations are blocked if the slot's StartTime is fewer
///     than 12 hours away from the current time.
/// </summary>
public class EnergyReservationService : IEnergyReservationService
{
    private readonly IEnergyReservationRepository _reservationRepo;
    private readonly IEnergyBookingSlotRepository _slotRepo;

    public EnergyReservationService(
        IEnergyReservationRepository reservationRepo,
        IEnergyBookingSlotRepository slotRepo)
    {
        _reservationRepo = reservationRepo;
        _slotRepo = slotRepo;
    }

    public async Task<List<EnergyReservation>> GetAllReservationsAsync() =>
        await _reservationRepo.GetAllAsync();

    public async Task<EnergyReservation?> GetReservationByIdAsync(string id) =>
        await _reservationRepo.GetByIdAsync(id);

    /// <summary>
    /// Creates a new prosumer reservation.
    /// Validates slot existence, availability, and the 7-Day Scheduling Rule.
    /// On success, atomically increments the physical slot's BookedBatterySlots.
    /// </summary>
    public async Task<EnergyReservation> CreateReservationAsync(EnergyReservation reservation)
    {
        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        if (slot == null)
            throw new ArgumentException(
                $"Energy booking slot '{reservation.SlotId}' does not exist.");

        if (slot.Status != "Open")
            throw new InvalidOperationException(
                $"This slot is not open for booking. Current status: {slot.Status}.");

        // ─── 7-Day Scheduling Rule ──────────────────────────────────────────────
        var timeDifference = slot.StartTime - DateTime.UtcNow;
        if (timeDifference.TotalDays < 0)
            throw new InvalidOperationException(
                "Reservations cannot be made for slots that have already started or passed.");
        if (timeDifference.TotalDays > 7)
            throw new InvalidOperationException(
                "Reservations can only be made for slots starting within the next 7 days.");
        // ────────────────────────────────────────────────────────────────────────

        // Attempt to atomically increment booked battery slots.
        // Assuming each reservation takes 1 bay. If the user provided RequestedKWh,
        // we might map that to bays, but let's assume 1 for now.
        int baysToBook = 1; 

        bool capacitySecured = await _slotRepo.IncrementBookedSlotsAtomicAsync(slot.Id, baysToBook);
        if (!capacitySecured)
        {
            throw new InvalidOperationException("Failed to secure capacity. The slot might be full.");
        }

        reservation.Status = "Pending";
        reservation.ReservationCode = $"RES-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 4).ToUpper()}";
        reservation.StationId = slot.StationId;
        reservation.StationName = slot.StationName;
        reservation.SlotStartTime = slot.StartTime;
        reservation.SlotEndTime = slot.EndTime;
        reservation.ReservationCreatedAtUtc = DateTime.UtcNow;
        reservation.LastModifiedAtUtc = DateTime.UtcNow;

        await _reservationRepo.CreateAsync(reservation);

        return reservation;
    }

    /// <summary>
    /// Modifies an existing reservation's prosumer details.
    /// Enforces the 12-Hour Modification Rule on the linked slot.
    /// </summary>
    public async Task UpdateReservationAsync(
        string id,
        EnergyReservation updatedReservation,
        string updatedByUserId)
    {
        var existing = await _reservationRepo.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException($"Reservation '{id}' not found.");

        var slot = await _slotRepo.GetByIdAsync(existing.SlotId);
        if (slot == null)
            throw new ArgumentException("Linked energy booking slot no longer exists.");

        // ─── 12-Hour Modification Rule ──────────────────────────────────────────
        var timeUntilStart = existing.SlotStartTime - DateTime.UtcNow;
        if (timeUntilStart.TotalHours < 12)
            throw new InvalidOperationException(
                "Modifications are not allowed less than 12 hours before the slot's start time. " +
                $"Slot starts at {existing.SlotStartTime:yyyy-MM-dd HH:mm} UTC.");
        // ────────────────────────────────────────────────────────────────────────

        // If the slot is being changed
        if (existing.SlotId != updatedReservation.SlotId)
        {
            var newSlot = await _slotRepo.GetByIdAsync(updatedReservation.SlotId);
            if (newSlot == null)
                throw new ArgumentException($"New energy booking slot '{updatedReservation.SlotId}' does not exist.");
            
            var newTimeDifference = newSlot.StartTime - DateTime.UtcNow;
            if (newTimeDifference.TotalDays < 0 || newTimeDifference.TotalDays > 7)
                throw new InvalidOperationException("The new slot must start within the next 7 days.");

            bool capacitySecured = await _slotRepo.IncrementBookedSlotsAtomicAsync(newSlot.Id, 1);
            if (!capacitySecured)
                throw new InvalidOperationException("Failed to secure capacity on the new slot. It might be full.");

            await _slotRepo.DecrementBookedSlotsAsync(existing.SlotId, 1);

            updatedReservation.StationId = newSlot.StationId;
            updatedReservation.StationName = newSlot.StationName;
            updatedReservation.SlotStartTime = newSlot.StartTime;
            updatedReservation.SlotEndTime = newSlot.EndTime;
        }
        else
        {
            // Keep existing slot details
            updatedReservation.StationId = existing.StationId;
            updatedReservation.StationName = existing.StationName;
            updatedReservation.SlotStartTime = existing.SlotStartTime;
            updatedReservation.SlotEndTime = existing.SlotEndTime;
        }

        // Preserve immutable fields
        updatedReservation.Id = id;
        updatedReservation.ReservationCode = existing.ReservationCode;
        updatedReservation.ReservationCreatedAtUtc = existing.ReservationCreatedAtUtc;
        updatedReservation.CreatedByUserId = existing.CreatedByUserId;
        updatedReservation.LastModifiedAtUtc = DateTime.UtcNow;
        updatedReservation.UpdatedByUserId = updatedByUserId;

        await _reservationRepo.UpdateAsync(id, updatedReservation);
    }

    /// <summary>
    /// Cancels a reservation and releases the capacity back.
    /// Enforces the 12-Hour Cancellation Rule.
    /// </summary>
    public async Task CancelReservationAsync(string id, string cancelledByUserId)
    {
        var reservation = await _reservationRepo.GetByIdAsync(id);
        if (reservation == null)
            throw new KeyNotFoundException($"Reservation '{id}' not found.");

        // ─── 12-Hour Cancellation Rule ──────────────────────────────────────────
        var timeUntilStart = reservation.SlotStartTime - DateTime.UtcNow;
        if (timeUntilStart.TotalHours < 12)
            throw new InvalidOperationException(
                "Cancellations are not allowed less than 12 hours before the slot's start time. " +
                $"Slot starts at {reservation.SlotStartTime:yyyy-MM-dd HH:mm} UTC.");
        // ────────────────────────────────────────────────────────────────────────

        reservation.Status = "Cancelled";
        reservation.CancelledAtUtc = DateTime.UtcNow;
        reservation.CancelledByUserId = cancelledByUserId;
        reservation.LastModifiedAtUtc = DateTime.UtcNow;
        reservation.UpdatedByUserId = cancelledByUserId;
        await _reservationRepo.UpdateAsync(id, reservation);

        // Free up the physical slot
        await _slotRepo.DecrementBookedSlotsAsync(reservation.SlotId, 1);
    }
}
