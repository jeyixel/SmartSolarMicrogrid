using backend_service.Dtos;
using backend_service.Infrastructure;

namespace backend_service.Services;

/// <summary>
/// All business logic for microgrid nodes. Knows nothing about HTTP and nothing
/// about MongoDB: it takes the caller's identity as plain parameters and reaches
/// storage through <see cref="Repositories.IStationRepository"/>.
/// </summary>
public interface IStationService
{
    Task<ServiceResult<StationResponse>> CreateAsync(
        CreateStationRequest request, string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Full document including audit fields, for staff. A Prosumer is served
    /// <see cref="GetPublicDetailAsync"/> instead, which hides audit data and
    /// reports a non-active station as absent.
    /// </summary>
    Task<ServiceResult<StationResponse>> GetByIdAsync(
        string id, CancellationToken cancellationToken = default);

    Task<ServiceResult<PagedResponse<StationSummaryResponse>>> GetPagedAsync(
        StationListQuery query, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a station. A Grid Operator may change only the operational fields
    /// (available slots, contact phone, schedule); anything else is rejected.
    /// </summary>
    Task<ServiceResult<StationResponse>> UpdateAsync(
        string id, UpdateStationRequest request, string userId, bool isBackoffice,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes a station out of service, but only when the reservation module
    /// reports no active reservations against it.
    /// </summary>
    Task<ServiceResult<StationResponse>> DeactivateAsync(
        string id, string? reason, string userId, CancellationToken cancellationToken = default);

    Task<ServiceResult<StationResponse>> ActivateAsync(
        string id, string userId, CancellationToken cancellationToken = default);

    /// <summary>Read-only pre-check so the web UI can warn before the operator clicks.</summary>
    Task<ServiceResult<DeactivationEligibilityResponse>> GetDeactivationEligibilityAsync(
        string id, CancellationToken cancellationToken = default);

    Task<ServiceResult<List<StationMapSummaryResponse>>> GetNearbyAsync(
        NearbyStationQuery query, CancellationToken cancellationToken = default);

    Task<ServiceResult<StationDetailResponse>> GetPublicDetailAsync(
        string id, CancellationToken cancellationToken = default);

    Task<ServiceResult<List<StationLookupResponse>>> GetLookupAsync(
        CancellationToken cancellationToken = default);
}
