using backend_service.Models;
using MongoDB.Driver;

namespace backend_service.Data;

public class EnergyBookingSlotRepository : IEnergyBookingSlotRepository
{
    private readonly IMongoCollection<EnergyBookingSlot> _slots;

    public EnergyBookingSlotRepository(IMongoDatabase database)
    {
        _slots = database.GetCollection<EnergyBookingSlot>("EnergyBookingSlots");
    }

    public async Task<List<EnergyBookingSlot>> GetAllAsync() =>
        await _slots.Find(_ => true).ToListAsync();

    public async Task<EnergyBookingSlot?> GetByIdAsync(string id) =>
        await _slots.Find(x => x.Id == id).FirstOrDefaultAsync();

    public async Task<List<EnergyBookingSlot>> GetByStationIdAsync(string stationId) =>
        await _slots.Find(x => x.StationId == stationId).ToListAsync();

    public async Task CreateAsync(EnergyBookingSlot slot) =>
        await _slots.InsertOneAsync(slot);

    public async Task UpdateAsync(string id, EnergyBookingSlot slot) =>
        await _slots.ReplaceOneAsync(x => x.Id == id, slot);

    public async Task DeleteAsync(string id) =>
        await _slots.DeleteOneAsync(x => x.Id == id);
}
