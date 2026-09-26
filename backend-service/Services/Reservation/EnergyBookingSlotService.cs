using backend_service.Data;
using backend_service.Models;

namespace backend_service.Services;

public class EnergyBookingSlotService : IEnergyBookingSlotService
{
    private readonly IEnergyBookingSlotRepository _slotRepo;

    public EnergyBookingSlotService(IEnergyBookingSlotRepository slotRepo)
    {
        _slotRepo = slotRepo;
    }

    public async Task<List<EnergyBookingSlot>> GetAllSlotsAsync() =>
        await _slotRepo.GetAllAsync();

    public async Task<EnergyBookingSlot?> GetSlotByIdAsync(string id) =>
        await _slotRepo.GetByIdAsync(id);

    public async Task<List<EnergyBookingSlot>> GetSlotsByStationAsync(string stationId) =>
        await _slotRepo.GetByStationIdAsync(stationId);

    public async Task<EnergyBookingSlot> CreateSlotAsync(EnergyBookingSlot slot, string createdByUserId)
    {
        slot.Status = "Available";
        slot.CreatedByUserId = createdByUserId;
        slot.UpdatedByUserId = createdByUserId;
        slot.CreatedAt = DateTime.UtcNow;
        slot.UpdatedAt = DateTime.UtcNow;

        await _slotRepo.CreateAsync(slot);
        return slot;
    }

    public async Task UpdateSlotAsync(string id, EnergyBookingSlot slot, string updatedByUserId)
    {
        var existing = await _slotRepo.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException($"Booking slot '{id}' not found.");

        // Preserve immutable audit fields
        slot.Id = id;
        slot.CreatedByUserId = existing.CreatedByUserId;
        slot.CreatedAt = existing.CreatedAt;
        slot.UpdatedByUserId = updatedByUserId;
        slot.UpdatedAt = DateTime.UtcNow;

        await _slotRepo.UpdateAsync(id, slot);
    }

    public async Task DeleteSlotAsync(string id)
    {
        var existing = await _slotRepo.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException($"Booking slot '{id}' not found.");

        await _slotRepo.DeleteAsync(id);
    }
}
