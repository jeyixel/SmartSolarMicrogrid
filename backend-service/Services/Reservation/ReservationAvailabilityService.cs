using backend_service.Abstractions;
using backend_service.Data;

namespace backend_service.Services;

/// <summary>Checks actual reservations before a station can be deactivated.</summary>
public sealed class ReservationAvailabilityService(
    IEnergyReservationRepository reservations) : IReservationAvailabilityService
{
    public async Task<int> GetActiveReservationCountAsync(
        string stationId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(stationId);
        var count = await reservations.CountActiveByStationAsync(
            stationId, DateTime.UtcNow, cancellationToken);
        return checked((int)count);
    }
}
