using backend_service.Models;

namespace backend_service.Services;

public interface IEnergyBookingSlotService
{
    Task<List<EnergyBookingSlot>> GetAllSlotsAsync();
    Task<EnergyBookingSlot?> GetSlotByIdAsync(string id);
    Task<List<EnergyBookingSlot>> GetSlotsByStationAsync(string stationId);
    Task<EnergyBookingSlot> CreateSlotAsync(EnergyBookingSlot slot, string createdByUserId);
    Task UpdateSlotAsync(string id, EnergyBookingSlot slot, string updatedByUserId);
    Task DeleteSlotAsync(string id);
}
