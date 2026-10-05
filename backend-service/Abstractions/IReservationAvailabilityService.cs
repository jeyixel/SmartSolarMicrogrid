namespace backend_service.Abstractions;

/// <summary>
/// The one question the station module asks the reservation module: does this
/// station still owe anybody energy?
/// </summary>
/// <remarks>
/// Owned by Member 2 (station module), implemented by Member 3 (reservations).
/// The dependency runs one way only: the station module never reads reservation
/// documents and never interprets reservation statuses, so Member 3 can change
/// how reservations are stored — and what "active" means — without touching any
/// code here.
/// </remarks>
public interface IReservationAvailabilityService
{
    /// <summary>
    /// Counts reservations against <paramref name="stationId"/> that still bind
    /// the station: status Pending or Approved, and a slot that has not yet
    /// passed. Completed, cancelled, rejected and expired reservations do not
    /// count and must not block an operator.
    /// </summary>
    /// <returns>Zero when the station is free. Never throws for "none found".</returns>
    /// <exception cref="Exception">
    /// Only on genuine failure (storage unavailable). The station module treats
    /// any exception as "unknown" and refuses to deactivate.
    /// </exception>
    Task<int> GetActiveReservationCountAsync(string stationId, CancellationToken cancellationToken = default);
}
