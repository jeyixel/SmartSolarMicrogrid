using backend_service.Models;

namespace backend_service.Data;

public interface IEnergyBookingSlotRepository
{
    Task<List<EnergyBookingSlot>> GetAllAsync();
    Task<EnergyBookingSlot?> GetByIdAsync(string id);
    Task<List<EnergyBookingSlot>> GetByStationIdAsync(string stationId);
    Task CreateAsync(EnergyBookingSlot slot);
    Task UpdateAsync(string id, EnergyBookingSlot slot);
    Task DeleteAsync(string id);
}
