using backend_service.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend_service.Data;

public interface IEnergyBookingSlotRepository
{
    Task<List<EnergyBookingSlot>> GetAllAsync();
    Task<EnergyBookingSlot?> GetByIdAsync(string id);
    Task CreateAsync(EnergyBookingSlot slot);
    Task UpdateAsync(string id, EnergyBookingSlot slot);
    Task DeleteAsync(string id);
}

