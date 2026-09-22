using backend_service.Data;
using backend_service.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend_service.Services;

public class EnergyBookingSlotService : IEnergyBookingSlotService
{
    private readonly IEnergyBookingSlotRepository _slotRepo;

    public EnergyBookingSlotService(IEnergyBookingSlotRepository slotRepo)
    {
        _slotRepo = slotRepo;
    }

    public async Task<List<EnergyBookingSlot>> GetAllSlotsAsync()
    {
        return await _slotRepo.GetAllAsync();
    }

    public async Task<EnergyBookingSlot?> GetSlotByIdAsync(string id)
    {
        return await _slotRepo.GetByIdAsync(id);
    }

    public async Task<EnergyBookingSlot> CreateSlotAsync(EnergyBookingSlot slot)
    {
        await _slotRepo.CreateAsync(slot);
        return slot;
    }

    public async Task UpdateSlotAsync(string id, EnergyBookingSlot slot)
    {
        slot.Id = id;
        await _slotRepo.UpdateAsync(id, slot);
    }

    public async Task DeleteSlotAsync(string id)
    {
        await _slotRepo.DeleteAsync(id);
    }
}

