using backend_service.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend_service.Data;

public interface IEnergyReservationRepository
{
    Task<List<EnergyReservation>> GetAllAsync();
    Task<EnergyReservation?> GetByIdAsync(string id);
    Task<List<EnergyReservation>> GetByProsumerIdAsync(string prosumerId);
    Task CreateAsync(EnergyReservation reservation);
    Task UpdateAsync(string id, EnergyReservation reservation);
    Task DeleteAsync(string id);
}

