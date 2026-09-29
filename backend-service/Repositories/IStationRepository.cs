using backend_service.Models;

namespace backend_service.Repositories;

/// <summary>
/// Persistence for the station collection. Holds no rules — "may this station be
/// deactivated?" is never a repository question.
/// </summary>
public interface IStationRepository
{
    Task<SolarStationInfo> CreateAsync(SolarStationInfo station, CancellationToken cancellationToken = default);

    Task<SolarStationInfo?> GetByIdAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>One page of the management list, with the total before paging.</summary>
    Task<(List<SolarStationInfo> Items, long TotalCount)> GetPagedAsync(
        StationStatus? status,
        string? search,
        int page,
        int pageSize,
        string sortBy,
        bool ascending,
        CancellationToken cancellationToken = default);

    /// <summary>Replaces the station document. Returns false when the id no longer exists.</summary>
    Task<bool> ReplaceAsync(SolarStationInfo station, CancellationToken cancellationToken = default);

    /// <summary>
    /// Moves a station to <paramref name="newStatus"/> only if it is currently in
    /// <paramref name="expectedCurrentStatus"/>. The conditional filter makes
    /// concurrent deactivations safe: the second one matches nothing.
    /// </summary>
    Task<bool> TryChangeStatusAsync(
        string id,
        StationStatus expectedCurrentStatus,
        StationStatus newStatus,
        DateTime? deactivatedAtUtc,
        string? deactivationReason,
        string updatedByUserId,
        DateTime updatedAtUtc,
        CancellationToken cancellationToken = default);

    /// <summary>Case-insensitive code check, optionally excluding one station.</summary>
    Task<bool> StationCodeExistsAsync(string stationCode, string? excludingId = null, CancellationToken cancellationToken = default);

    /// <summary>All active stations — the candidate set for the nearby search.</summary>
    Task<List<SolarStationInfo>> GetActiveStationsAsync(CancellationToken cancellationToken = default);

    /// <summary>Active stations within a latitude/longitude box, to narrow the nearby search.</summary>
    Task<List<SolarStationInfo>> GetActiveStationsInBoundingBoxAsync(
        double minLatitude,
        double maxLatitude,
        double minLongitude,
        double maxLongitude,
        CancellationToken cancellationToken = default);
}
