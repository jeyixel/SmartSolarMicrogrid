using backend_service.Models;
using MongoDB.Driver;

namespace backend_service.Data;

public class EnergyReservationRepository : IEnergyReservationRepository
{
    private readonly IMongoCollection<EnergyReservation> _reservations;

    public EnergyReservationRepository(IMongoDatabase database)
    {
        _reservations = database.GetCollection<EnergyReservation>("EnergyReservations");
    }

    public async Task<List<EnergyReservation>> GetAllAsync() =>
        await _reservations.Find(_ => true).ToListAsync();

    public async Task<EnergyReservation?> GetByIdAsync(string id) =>
        await _reservations.Find(x => x.Id == id).FirstOrDefaultAsync();

    public async Task<List<EnergyReservation>> GetByProsumerNicAsync(string prosumerNic) =>
        await _reservations.Find(x => x.ProsumerNIC == prosumerNic).ToListAsync();

    public Task<long> CountActiveByStationAsync(string stationId, DateTime nowUtc, CancellationToken cancellationToken = default)
    {
        var filter = Builders<EnergyReservation>.Filter;
        // A legacy reservation with no end time must not silently allow deactivation.
        var notEnded = filter.Gt(x => x.SlotEndTime, nowUtc)
            | filter.Eq(x => x.SlotEndTime, default(DateTime))
            | filter.Exists(x => x.SlotEndTime, false);
        var active = filter.Eq(x => x.StationId, stationId)
            & filter.In(x => x.Status, new[] { "Pending", "Approved", "CheckedIn" })
            & notEnded;

        return _reservations.CountDocumentsAsync(active, cancellationToken: cancellationToken);
    }

    public async Task CreateAsync(EnergyReservation reservation) =>
        await _reservations.InsertOneAsync(reservation);

    public async Task UpdateAsync(string id, EnergyReservation reservation) =>
        await _reservations.ReplaceOneAsync(x => x.Id == id, reservation);

    public async Task DeleteAsync(string id) =>
        await _reservations.DeleteOneAsync(x => x.Id == id);
}
