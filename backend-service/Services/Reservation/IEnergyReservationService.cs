using backend_service.DTOs;
using backend_service.Models;

namespace backend_service.Services;

public interface IEnergyReservationService
{
    Task<List<EnergyReservation>> GetAllReservationsAsync();
    Task<EnergyReservation?> GetReservationByIdAsync(string id);
    Task<EnergyReservation> CreateReservationAsync(EnergyReservation reservation);
    Task UpdateReservationAsync(string id, EnergyReservation updatedReservation, string updatedByUserId);
    Task CancelReservationAsync(string id, string cancelledByUserId);
    Task<DashboardStatsDto> GetDashboardStatsAsync(string nic);
    Task<List<ReservationHistoryDto>> GetHistoryAsync(string nic, string? status = null, DateTime? fromDate = null, DateTime? toDate = null, string? search = null);
}
