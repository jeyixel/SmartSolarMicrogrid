using backend_service.Data;
using backend_service.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend_service.Services;

public class EnergyReservationService : IEnergyReservationService
{
    private readonly IEnergyReservationRepository _reservationRepo;
    private readonly IEnergyBookingSlotRepository _slotRepo;

    public EnergyReservationService(IEnergyReservationRepository reservationRepo, IEnergyBookingSlotRepository slotRepo)
    {
        _reservationRepo = reservationRepo;
        _slotRepo = slotRepo;
    }

    public async Task<List<EnergyReservation>> GetAllReservationsAsync()
    {
        return await _reservationRepo.GetAllAsync();
    }

    public async Task<EnergyReservation?> GetReservationByIdAsync(string id)
    {
        return await _reservationRepo.GetByIdAsync(id);
    }

    public async Task<EnergyReservation> CreateReservationAsync(EnergyReservation reservation)
    {
        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        if (slot == null)
        {
            throw new ArgumentException("Linked energy booking slot does not exist.");
        }

        if (slot.Status != "Available")
        {
            throw new InvalidOperationException("This slot is not available for booking.");
        }

        // 7-Day Scheduling Rule
        var timeDifference = slot.StartTime - DateTime.UtcNow;
        if (timeDifference.TotalDays > 7 || timeDifference.TotalDays < 0)
        {
            throw new InvalidOperationException("Reservations can only be made for slots starting within the next 7 days.");
        }

        reservation.CreatedAt = DateTime.UtcNow;
        reservation.Status = "Active";

        await _reservationRepo.CreateAsync(reservation);
        
        // Update slot status
        slot.Status = "Booked";
        await _slotRepo.UpdateAsync(slot.Id, slot);

        return reservation;
    }

    public async Task UpdateReservationAsync(string id, EnergyReservation updatedReservation)
    {
        var existingReservation = await _reservationRepo.GetByIdAsync(id);
        if (existingReservation == null)
        {
            throw new KeyNotFoundException("Reservation not found.");
        }

        var slot = await _slotRepo.GetByIdAsync(existingReservation.SlotId);
        if (slot == null)
        {
            throw new ArgumentException("Linked energy booking slot does not exist.");
        }

        // 12-Hour Modification Rule
        var timeUntilStart = slot.StartTime - DateTime.UtcNow;
        if (timeUntilStart.TotalHours < 12)
        {
            throw new InvalidOperationException("Modifications are not allowed less than 12 hours before the slot's start time.");
        }

        updatedReservation.Id = id;
        updatedReservation.CreatedAt = existingReservation.CreatedAt;
        
        await _reservationRepo.UpdateAsync(id, updatedReservation);
    }

    public async Task CancelReservationAsync(string id)
    {
        var reservation = await _reservationRepo.GetByIdAsync(id);
        if (reservation == null)
        {
            throw new KeyNotFoundException("Reservation not found.");
        }

        var slot = await _slotRepo.GetByIdAsync(reservation.SlotId);
        if (slot == null)
        {
            throw new ArgumentException("Linked energy booking slot does not exist.");
        }

        // 12-Hour Modification Rule
        var timeUntilStart = slot.StartTime - DateTime.UtcNow;
        if (timeUntilStart.TotalHours < 12)
        {
            throw new InvalidOperationException("Cancellations are not allowed less than 12 hours before the slot's start time.");
        }

        reservation.Status = "Cancelled";
        await _reservationRepo.UpdateAsync(id, reservation);

        // Free up the slot
        slot.Status = "Available";
        await _slotRepo.UpdateAsync(slot.Id, slot);
    }
}

