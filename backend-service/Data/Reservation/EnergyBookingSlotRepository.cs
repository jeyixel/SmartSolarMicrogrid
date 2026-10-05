using backend_service.Models;
using MongoDB.Driver;
using MongoDB.Bson;

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

    public async Task<bool> IncrementBookedSlotsAtomicAsync(string slotId, int count)
    {
        var filter = Builders<EnergyBookingSlot>.Filter.And(
            Builders<EnergyBookingSlot>.Filter.Eq(x => x.Id, slotId),
            (FilterDefinition<EnergyBookingSlot>)new BsonDocument("$expr", 
                new BsonDocument("$lt", new BsonArray { "$BookedBatterySlots", "$TotalBatterySlots" })
            )
        );

        var update = Builders<EnergyBookingSlot>.Update
            .Inc(x => x.BookedBatterySlots, count)
            .Set(x => x.UpdatedAtUtc, DateTime.UtcNow);

        // findOneAndUpdate equivalent
        var result = await _slots.FindOneAndUpdateAsync(filter, update);

        // If result is null, it means no document matched the filter (either doesn't exist, or capacity is full)
        return result != null;
    }

    public async Task DecrementBookedSlotsAsync(string slotId, int count)
    {
        var filter = Builders<EnergyBookingSlot>.Filter.Eq(x => x.Id, slotId);
        var update = Builders<EnergyBookingSlot>.Update
            .Inc(x => x.BookedBatterySlots, -count)
            .Set(x => x.UpdatedAtUtc, DateTime.UtcNow);

        await _slots.UpdateOneAsync(filter, update);
    }
}
