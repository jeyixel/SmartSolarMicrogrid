using backend_service.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend_service.Services;

public interface IEnergyBookingSlotService
{
    Task<List<EnergyBookingSlot>> GetAllSlotsAsync();
    Task<EnergyBookingSlot?> GetSlotByIdAsync(string id);
    Task<EnergyBookingSlot> CreateSlotAsync(EnergyBookingSlot slot);
    Task UpdateSlotAsync(string id, EnergyBookingSlot slot);
    Task DeleteSlotAsync(string id);
}

