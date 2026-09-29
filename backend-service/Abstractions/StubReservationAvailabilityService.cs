namespace backend_service.Abstractions;

/// <summary>
/// Placeholder used until Member 3's reservation module is available. Reports
/// that no station has active reservations, so every deactivation succeeds.
/// </summary>
/// <remarks>
/// Registered only outside Production (see Program.cs) and logs a warning on
/// every call, so a missing real implementation cannot pass unnoticed. Delete
/// this class once Member 3 registers the real service.
/// </remarks>
public sealed class StubReservationAvailabilityService : IReservationAvailabilityService
{
    private readonly ILogger<StubReservationAvailabilityService> _logger;

    public StubReservationAvailabilityService(ILogger<StubReservationAvailabilityService> logger)
    {
        _logger = logger;
    }

    public Task<int> GetActiveReservationCountAsync(string stationId, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "Reservation availability is stubbed: reporting 0 active reservations for station {StationId}. " +
            "Deactivation is NOT actually guarded until Member 3's implementation is registered.",
            stationId);

        return Task.FromResult(0);
    }
}
