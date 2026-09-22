using backend_service.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend_service.Services;

public interface IEnergyReservationService
{
    Task<List<EnergyReservation>> GetAllReservationsAsync();
    Task<EnergyReservation?> GetReservationByIdAsync(string id);
    Task<EnergyReservation> CreateReservationAsync(EnergyReservation reservation);
    Task UpdateReservationAsync(string id, EnergyReservation updatedReservation);
    Task CancelReservationAsync(string id);
}

