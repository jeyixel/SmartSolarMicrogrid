using backend_service.Data;
using backend_service.DTOs;
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
    /// On success, marks the physical slot as "Booked".
    /// </summary>
    public async Task<EnergyReservation> CreateReservationAsync(EnergyReservation reservation)
    {
        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        if (slot == null)
            throw new ArgumentException(
                $"Energy booking slot '{reservation.SlotId}' does not exist.");

        if (slot.Status != "Available")
            throw new InvalidOperationException(
                $"This slot is not available for booking. Current status: {slot.Status}.");

        // ─── 7-Day Scheduling Rule ──────────────────────────────────────────────
        var timeDifference = slot.StartTime - DateTime.UtcNow;
        if (timeDifference.TotalDays < 0)
            throw new InvalidOperationException(
                "Reservations cannot be made for slots that have already started or passed.");
        if (timeDifference.TotalDays > 7)
            throw new InvalidOperationException(
                "Reservations can only be made for slots starting within the next 7 days.");
        // ────────────────────────────────────────────────────────────────────────

        reservation.Status = "Pending";
        reservation.CreatedAt = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        await _reservationRepo.CreateAsync(reservation);

        // Mark the physical slot as Booked
        slot.Status = "Booked";
        slot.UpdatedAt = DateTime.UtcNow;
        await _slotRepo.UpdateAsync(slot.Id, slot);

        return reservation;
    }

    /// <summary>
    /// Modifies an existing reservation's prosumer details.
    /// Enforces the 12-Hour Modification Rule on the linked slot.
    /// The original SlotId is preserved — slot re-assignment requires cancel + rebook.
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
            throw new ArgumentException(
                "Linked energy booking slot no longer exists.");

        // ─── 12-Hour Modification Rule ──────────────────────────────────────────
        var timeUntilStart = slot.StartTime - DateTime.UtcNow;
        if (timeUntilStart.TotalHours < 12)
            throw new InvalidOperationException(
                "Modifications are not allowed less than 12 hours before the slot's start time. " +
                $"Slot starts at {slot.StartTime:yyyy-MM-dd HH:mm} UTC.");
        // ────────────────────────────────────────────────────────────────────────

        // Preserve immutable fields
        updatedReservation.Id = id;
        updatedReservation.SlotId = existing.SlotId;
        updatedReservation.CreatedAt = existing.CreatedAt;
        updatedReservation.CreatedByUserId = existing.CreatedByUserId;
        updatedReservation.UpdatedAt = DateTime.UtcNow;
        updatedReservation.UpdatedByUserId = updatedByUserId;

        await _reservationRepo.UpdateAsync(id, updatedReservation);
    }

    /// <summary>
    /// Cancels a reservation and releases the linked physical slot back to "Available".
    /// Enforces the 12-Hour Cancellation Rule.
    /// </summary>
    public async Task CancelReservationAsync(string id, string cancelledByUserId)
    {
        var reservation = await _reservationRepo.GetByIdAsync(id);
        if (reservation == null)
            throw new KeyNotFoundException($"Reservation '{id}' not found.");

        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        if (slot == null)
            throw new ArgumentException(
                "Linked energy booking slot no longer exists.");

        // ─── 12-Hour Cancellation Rule ──────────────────────────────────────────
        var timeUntilStart = slot.StartTime - DateTime.UtcNow;
        if (timeUntilStart.TotalHours < 12)
            throw new InvalidOperationException(
                "Cancellations are not allowed less than 12 hours before the slot's start time. " +
                $"Slot starts at {slot.StartTime:yyyy-MM-dd HH:mm} UTC.");
        // ────────────────────────────────────────────────────────────────────────

        reservation.Status = "Cancelled";
        reservation.UpdatedAt = DateTime.UtcNow;
        reservation.UpdatedByUserId = cancelledByUserId;
        await _reservationRepo.UpdateAsync(id, reservation);

        // Free up the physical slot
        slot.Status = "Available";
        slot.UpdatedAt = DateTime.UtcNow;
        await _slotRepo.UpdateAsync(slot.Id, slot);
    }

    /// <summary>
    /// Computes dashboard statistics for a specific prosumer identified by NIC.
    /// Aggregates pending reservation counts and upcoming approved/future reservations.
    /// </summary>
    public async Task<DashboardStatsDto> GetDashboardStatsAsync(string nic)
    {
        // Query all reservations linked to this prosumer's NIC
        var reservations = await _reservationRepo.GetByProsumerNicAsync(nic);

        int pendingCount = 0;
        int upcomingApprovedCount = 0;
        var now = DateTime.UtcNow;

        // Iterate through reservations to compute status and time-based metrics
        foreach (var reservation in reservations)
        {
            if (string.Equals(reservation.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            {
                pendingCount++;
            }

            // Count approved/confirmed reservations whose booking slot starts in the future
            if (string.Equals(reservation.Status, "Approved", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(reservation.Status, "Confirmed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(reservation.Status, "Booked", StringComparison.OrdinalIgnoreCase))
            {
                var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
                if (slot != null && slot.StartTime > now)
                {
                    upcomingApprovedCount++;
                }
            }
        }

        return new DashboardStatsDto
        {
            PendingCount = pendingCount,
            UpcomingApprovedCount = upcomingApprovedCount,
            TotalBookingsCount = reservations.Count
        };
    }

    /// <summary>
    /// Retrieves prosumer booking history with optional status, date range, and text filtering.
    /// Joins each reservation with physical slot time windows, action type, and capacity details.
    /// </summary>
    public async Task<List<ReservationHistoryDto>> GetHistoryAsync(
        string nic,
        string? status = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string? search = null)
    {
        // Query all reservations for this prosumer NIC
        var reservations = await _reservationRepo.GetByProsumerNicAsync(nic);
        var result = new List<ReservationHistoryDto>();

        foreach (var res in reservations)
        {
            // Apply status filter if specified
            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.Equals(res.Status, status, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
            }

            // Fetch linked physical slot details for enriched telemetry
            var slot = await _slotRepo.GetByIdAsync(res.SlotId);
            var slotStart = slot?.StartTime ?? res.CreatedAt;
            var slotEnd = slot?.EndTime ?? res.CreatedAt.AddHours(1);
            var stationId = slot?.StationId ?? "N/A";
            var actionType = slot?.ActionType ?? "Drop-off";
            var energyAmount = slot?.EnergyAmountKWh ?? 0;

            // Apply date range filters
            if (fromDate.HasValue && slotStart < fromDate.Value)
            {
                continue;
            }
            if (toDate.HasValue && slotStart > toDate.Value)
            {
                continue;
            }

            // Apply text search across reservation attributes
            if (!string.IsNullOrWhiteSpace(search))
            {
                var query = search.Trim();
                bool matches = res.Id.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                               stationId.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                               actionType.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                               res.Status.Contains(query, StringComparison.OrdinalIgnoreCase);

                if (!matches)
                {
                    continue;
                }
            }

            result.Add(new ReservationHistoryDto
            {
                Id = res.Id,
                ProsumerNIC = res.ProsumerNIC,
                SlotId = res.SlotId,
                StationId = stationId,
                StartTime = slotStart,
                EndTime = slotEnd,
                EnergyAmountKWh = energyAmount,
                ActionType = actionType,
                Status = res.Status,
                CreatedAt = res.CreatedAt,
                UpdatedAt = res.UpdatedAt
            });
        }

        // Return ordered by newest start time first
        return result.OrderByDescending(x => x.StartTime).ToList();
    }
}
