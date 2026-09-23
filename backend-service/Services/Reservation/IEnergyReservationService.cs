using backend_service.Models;

namespace backend_service.Services;

public interface IEnergyReservationService
{
    Task<List<EnergyReservation>> GetAllReservationsAsync();
    Task<EnergyReservation?> GetReservationByIdAsync(string id);
    Task<EnergyReservation> CreateReservationAsync(EnergyReservation reservation);
    Task UpdateReservationAsync(string id, EnergyReservation updatedReservation, string updatedByUserId);
    Task CancelReservationAsync(string id, string cancelledByUserId);
}
