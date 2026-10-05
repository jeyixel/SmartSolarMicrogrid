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
            updatedReservation.StationName = !string.IsNullOrWhiteSpace(existing.StationName) ? existing.StationName : (slot?.StationName ?? existing.StationId);
            updatedReservation.SlotStartTime = existing.SlotStartTime;
            updatedReservation.SlotEndTime = existing.SlotEndTime;
        }

        // Preserve immutable and identity fields
        updatedReservation.Id = id;
        updatedReservation.ReservationCode = existing.ReservationCode;
        updatedReservation.ReservationCreatedAtUtc = existing.ReservationCreatedAtUtc;
        updatedReservation.CreatedByUserId = existing.CreatedByUserId;
        updatedReservation.LastModifiedAtUtc = DateTime.UtcNow;
        updatedReservation.UpdatedByUserId = updatedByUserId;

        if (string.IsNullOrWhiteSpace(updatedReservation.ProsumerNIC))
        {
            updatedReservation.ProsumerNIC = existing.ProsumerNIC;
        }
        if (string.IsNullOrWhiteSpace(updatedReservation.ProsumerName))
        {
            updatedReservation.ProsumerName = existing.ProsumerName;
        }
        if (string.IsNullOrWhiteSpace(updatedReservation.Status))
        {
            updatedReservation.Status = existing.Status;
        }

        // Handle QR token preservation based on whether physical slot has changed
        if (existing.SlotId == updatedReservation.SlotId)
        {
            // Same slot — only details like kWh changed, the QR is still valid for this time/place
            updatedReservation.QrCodeToken = existing.QrCodeToken;
            updatedReservation.QrCodeGeneratedAtUtc = existing.QrCodeGeneratedAtUtc;
            updatedReservation.QrCodeVerifiedAtUtc = existing.QrCodeVerifiedAtUtc;
            updatedReservation.QrCodeVerifiedByUserId = existing.QrCodeVerifiedByUserId;
        }
        else
        {
            // Slot changed — reset QR fields so a fresh QR pass is generated for the new station/time
            updatedReservation.QrCodeToken = null;
            updatedReservation.QrCodeGeneratedAtUtc = null;
            updatedReservation.QrCodeVerifiedAtUtc = null;
            updatedReservation.QrCodeVerifiedByUserId = null;
        }

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

        if (string.Equals(reservation.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Reservation is already cancelled.");

        if (string.Equals(reservation.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Completed reservations cannot be cancelled.");

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

        // Invalidate active QR token metadata so a cancelled booking's QR cannot be scanned
        reservation.QrCodeToken = null;
        reservation.QrCodeGeneratedAtUtc = null;
        reservation.QrCodeVerifiedAtUtc = null;
        reservation.QrCodeVerifiedByUserId = null;

        await _reservationRepo.UpdateAsync(id, reservation);

        // Free up the physical slot
        await _slotRepo.DecrementBookedSlotsAsync(reservation.SlotId, 1);
    }

    /// <summary>
    /// Approves a pending reservation and automatically generates its secure transaction QR pass.
    /// Only Pending reservations can be approved.
    /// </summary>
    public async Task<EnergyReservation> ApproveReservationAsync(string id, string approvedByUserId)
    {
        var reservation = await _reservationRepo.GetByIdAsync(id);
        if (reservation == null)
            throw new KeyNotFoundException($"Reservation '{id}' not found.");

        if (!string.Equals(reservation.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cannot approve reservation '{id}' because its status is '{reservation.Status}'. Only Pending reservations can be approved.");

        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        if (slot == null)
            throw new ArgumentException("Linked energy booking slot no longer exists.");

        if (slot.EndTime < DateTime.UtcNow)
            throw new InvalidOperationException("Cannot approve reservation because the booking slot time window has already passed.");

        reservation.Status = "Approved";
        reservation.LastModifiedAtUtc = DateTime.UtcNow;
        reservation.UpdatedByUserId = approvedByUserId;

        // Automatically generate dynamic QR verification token upon approval
        if (string.IsNullOrWhiteSpace(reservation.QrCodeToken))
        {
            var code = !string.IsNullOrWhiteSpace(reservation.ReservationCode)
                ? reservation.ReservationCode
                : reservation.Id;
            reservation.QrCodeToken = $"SSM:RES:{code}:{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
            reservation.QrCodeGeneratedAtUtc = DateTime.UtcNow;
        }

        await _reservationRepo.UpdateAsync(id, reservation);
        return reservation;
    }

    /// <summary>
    /// Rejects a pending reservation, records the rejection reason, and immediately releases the reserved slot capacity back.
    /// Only Pending reservations can be rejected.
    /// </summary>
    public async Task<EnergyReservation> RejectReservationAsync(string id, string? reason, string rejectedByUserId)
    {
        var reservation = await _reservationRepo.GetByIdAsync(id);
        if (reservation == null)
            throw new KeyNotFoundException($"Reservation '{id}' not found.");

        if (!string.Equals(reservation.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cannot reject reservation '{id}' because its status is '{reservation.Status}'. Only Pending reservations can be rejected.");

        reservation.Status = "Rejected";
        reservation.CancellationReason = !string.IsNullOrWhiteSpace(reason) ? reason.Trim() : "Rejected by Grid Operator";
        reservation.CancelledAtUtc = DateTime.UtcNow;
        reservation.CancelledByUserId = rejectedByUserId;
        reservation.LastModifiedAtUtc = DateTime.UtcNow;
        reservation.UpdatedByUserId = rejectedByUserId;

        // Invalidate any active QR token metadata
        reservation.QrCodeToken = null;
        reservation.QrCodeGeneratedAtUtc = null;
        reservation.QrCodeVerifiedAtUtc = null;
        reservation.QrCodeVerifiedByUserId = null;

        await _reservationRepo.UpdateAsync(id, reservation);

        // Immediately release physical slot capacity back
        await _slotRepo.DecrementBookedSlotsAsync(reservation.SlotId, 1);

        return reservation;
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
            var slotStart = res.SlotStartTime != default ? res.SlotStartTime : (slot?.StartTime ?? res.ReservationCreatedAtUtc);
            var slotEnd = res.SlotEndTime != default ? res.SlotEndTime : (slot?.EndTime ?? res.ReservationCreatedAtUtc.AddHours(1));
            var stationId = !string.IsNullOrWhiteSpace(res.StationId) ? res.StationId : (slot?.StationId ?? "N/A");
            var stationName = !string.IsNullOrWhiteSpace(res.StationName) ? res.StationName : (slot?.StationName ?? stationId);
            var actionType = slot?.TradeType ?? "Charging";
            var energyAmount = res.RequestedKWh > 0 ? res.RequestedKWh : (slot?.TotalCapacityKWh ?? 0);

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
                               (!string.IsNullOrEmpty(res.ReservationCode) && res.ReservationCode.Contains(query, StringComparison.OrdinalIgnoreCase)) ||
                               stationId.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                               stationName.Contains(query, StringComparison.OrdinalIgnoreCase) ||
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
                StationName = stationName,
                StartTime = slotStart,
                EndTime = slotEnd,
                EnergyAmountKWh = energyAmount,
                ActionType = actionType,
                Status = res.Status,
                QrToken = res.QrCodeToken,
                CreatedAt = res.ReservationCreatedAtUtc,
                UpdatedAt = res.LastModifiedAtUtc
            });
        }

        // Return ordered by newest start time first
        return result.OrderByDescending(x => x.StartTime).ToList();
    }

    /// <summary>
    /// Generates or retrieves the dynamic QR verification token for an approved reservation.
    /// Updates the reservation with the token and timestamp if not already generated.
    /// </summary>
    public async Task<QrCodeDetailsDto> GenerateOrGetQrCodeAsync(string reservationId)
    {
        var reservation = await _reservationRepo.GetByIdAsync(reservationId);
        if (reservation == null)
        {
            throw new KeyNotFoundException($"Reservation '{reservationId}' not found.");
        }

        if (!string.Equals(reservation.Status, "Approved", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(reservation.Status, "Confirmed", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(reservation.Status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"QR code pass is only available for approved reservations. Current status is '{reservation.Status}'.");
        }

        // Generate token if not yet present
        if (string.IsNullOrWhiteSpace(reservation.QrCodeToken))
        {
            var code = !string.IsNullOrWhiteSpace(reservation.ReservationCode) 
                ? reservation.ReservationCode 
                : reservation.Id;
            reservation.QrCodeToken = $"SSM:RES:{code}:{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
            reservation.QrCodeGeneratedAtUtc = DateTime.UtcNow;
            reservation.LastModifiedAtUtc = DateTime.UtcNow;

            await _reservationRepo.UpdateAsync(reservation.Id, reservation);
        }

        // Retrieve physical slot details to enrich the QR payload
        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        var slotStart = reservation.SlotStartTime != default ? reservation.SlotStartTime : (slot?.StartTime ?? reservation.ReservationCreatedAtUtc);
        var slotEnd = reservation.SlotEndTime != default ? reservation.SlotEndTime : (slot?.EndTime ?? reservation.ReservationCreatedAtUtc.AddHours(1));
        var stationId = !string.IsNullOrWhiteSpace(reservation.StationId) ? reservation.StationId : (slot?.StationId ?? "N/A");
        var stationName = !string.IsNullOrWhiteSpace(reservation.StationName) ? reservation.StationName : (slot?.StationName ?? stationId);
        var actionType = slot?.TradeType ?? "Charging";
        var energyAmount = reservation.RequestedKWh > 0 ? reservation.RequestedKWh : (slot?.TotalCapacityKWh ?? 0);

        return new QrCodeDetailsDto
        {
            ReservationId = reservation.Id,
            ReservationCode = reservation.ReservationCode,
            QrCodeToken = reservation.QrCodeToken,
            StationId = stationId,
            StationName = stationName,
            ProsumerNIC = reservation.ProsumerNIC,
            ProsumerName = reservation.ProsumerName,
            SlotStartTime = slotStart,
            SlotEndTime = slotEnd,
            RequestedKWh = energyAmount,
            ActionType = actionType,
            Status = reservation.Status,
            GeneratedAtUtc = reservation.QrCodeGeneratedAtUtc ?? DateTime.UtcNow
        };
    }

    /// <summary>
    /// Verifies a scanned QR code token presented by a prosumer at a solar station.
    /// Transitions reservation status to "Completed" and stamps operator audit fields.
    /// </summary>
    public async Task<EnergyTransferResultDto> VerifyAndFinalizeTransferAsync(VerifyQrRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.QrToken))
        {
            throw new ArgumentException("QR Code token cannot be empty.", nameof(request.QrToken));
        }

        var token = request.QrToken.Trim();
        var allReservations = await _reservationRepo.GetAllAsync();

        // Match by exact QrCodeToken or by parsed ReservationCode / Id
        var reservation = allReservations.FirstOrDefault(r => 
            string.Equals(r.QrCodeToken, token, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrEmpty(r.ReservationCode) && token.Contains(r.ReservationCode, StringComparison.OrdinalIgnoreCase)) ||
            (!string.IsNullOrEmpty(r.Id) && token.Contains(r.Id, StringComparison.OrdinalIgnoreCase)));

        if (reservation == null)
        {
            return new EnergyTransferResultDto
            {
                Success = false,
                Message = "Invalid QR code. No matching energy reservation was found in the system."
            };
        }

        if (string.Equals(reservation.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
        {
            return new EnergyTransferResultDto
            {
                Success = false,
                ReservationId = reservation.Id,
                ReservationCode = reservation.ReservationCode,
                ProsumerNIC = reservation.ProsumerNIC,
                Message = "Verification rejected: This reservation has been cancelled."
            };
        }

        if (string.Equals(reservation.Status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            return new EnergyTransferResultDto
            {
                Success = false,
                ReservationId = reservation.Id,
                ReservationCode = reservation.ReservationCode,
                ProsumerNIC = reservation.ProsumerNIC,
                Message = $"Energy transfer already completed on {reservation.QrCodeVerifiedAtUtc:dd MMM yyyy HH:mm} UTC."
            };
        }

        var previousStatus = reservation.Status;
        reservation.Status = "Completed";
        reservation.QrCodeVerifiedAtUtc = DateTime.UtcNow;
        reservation.QrCodeVerifiedByUserId = !string.IsNullOrWhiteSpace(request.OperatorUserId) 
            ? request.OperatorUserId 
            : "GridOperator";
        reservation.LastModifiedAtUtc = DateTime.UtcNow;

        await _reservationRepo.UpdateAsync(reservation.Id, reservation);

        // Fetch physical slot details to enrich result
        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        var stationId = !string.IsNullOrWhiteSpace(reservation.StationId) ? reservation.StationId : (slot?.StationId ?? "N/A");
        var stationName = !string.IsNullOrWhiteSpace(reservation.StationName) ? reservation.StationName : (slot?.StationName ?? stationId);
        var actionType = slot?.TradeType ?? "Charging";
        var energyAmount = reservation.RequestedKWh > 0 ? reservation.RequestedKWh : (slot?.TotalCapacityKWh ?? 0);

        return new EnergyTransferResultDto
        {
            Success = true,
            Message = "Energy transfer verified and session marked as COMPLETED successfully.",
            ReservationId = reservation.Id,
            ReservationCode = reservation.ReservationCode,
            ProsumerNIC = reservation.ProsumerNIC,
            ProsumerName = reservation.ProsumerName,
            StationId = stationId,
            StationName = stationName,
            TransferredKWh = energyAmount,
            ActionType = actionType,
            PreviousStatus = previousStatus,
            NewStatus = "Completed",
            VerifiedAtUtc = reservation.QrCodeVerifiedAtUtc.Value
        };
    }
}
