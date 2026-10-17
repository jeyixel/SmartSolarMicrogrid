using backend_service.Models;

namespace backend_service.Data;

public interface IEnergyReservationRepository
{
    Task<List<EnergyReservation>> GetAllAsync();
    Task<EnergyReservation?> GetByIdAsync(string id);
    Task<List<EnergyReservation>> GetByProsumerNicAsync(string prosumerNic);
    Task<long> CountActiveByStationAsync(string stationId, DateTime nowUtc, CancellationToken cancellationToken = default);
    Task CreateAsync(EnergyReservation reservation);
    Task UpdateAsync(string id, EnergyReservation reservation);
    Task DeleteAsync(string id);
}
