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

    public async Task<List<EnergyReservation>> GetByProsumerIdAsync(string prosumerId) =>
        await _reservations.Find(x => x.ProsumerId == prosumerId).ToListAsync();

    public async Task CreateAsync(EnergyReservation reservation) =>
        await _reservations.InsertOneAsync(reservation);

    public async Task UpdateAsync(string id, EnergyReservation reservation) =>
        await _reservations.ReplaceOneAsync(x => x.Id == id, reservation);

    public async Task DeleteAsync(string id) =>
        await _reservations.DeleteOneAsync(x => x.Id == id);
}

