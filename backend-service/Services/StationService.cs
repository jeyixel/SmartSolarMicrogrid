using backend_service.Abstractions;
using backend_service.Dtos;
using backend_service.Infrastructure;
using backend_service.Models;
using backend_service.Repositories;
using MongoDB.Bson;
using MongoDB.Driver;

namespace backend_service.Services;

/// <inheritdoc cref="IStationService"/>
public sealed class StationService : IStationService
{
    private static readonly HashSet<string> AllowedSortFields =
        new(StringComparer.OrdinalIgnoreCase) { "name", "createdAtUtc", "stationCode" };

    private readonly IStationRepository _repository;
    private readonly IReservationAvailabilityService _reservations;
    private readonly IScheduleEvaluator _schedule;
    private readonly ILogger<StationService> _logger;

    public StationService(
        IStationRepository repository,
        IReservationAvailabilityService reservations,
        IScheduleEvaluator schedule,
        ILogger<StationService> logger)
    {
        _repository = repository;
        _reservations = reservations;
        _schedule = schedule;
        _logger = logger;
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public async Task<ServiceResult<StationResponse>> CreateAsync(
        CreateStationRequest request, string userId, CancellationToken cancellationToken = default)
    {
        var coordinateError = ValidateCoordinates(request.Latitude!.Value, request.Longitude!.Value);
        if (coordinateError is not null)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.Validation, coordinateError, BuildCoordinateDetails(request.Latitude, request.Longitude));
        }

        if (request.AvailableBatterySlots!.Value > request.TotalBatterySlots!.Value)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.SlotInvariantViolated,
                "Available battery slots cannot exceed total battery slots.",
                new
                {
                    totalBatterySlots = request.TotalBatterySlots,
                    availableBatterySlots = request.AvailableBatterySlots
                });
        }

        var scheduleResult = ValidateSchedule(request.OperationalSchedule);
        if (!scheduleResult.Succeeded)
        {
            return ServiceResult<StationResponse>.Fail(scheduleResult);
        }

        var status = StationStatus.Active;
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (!Enum.TryParse<StationStatus>(request.Status, ignoreCase: true, out status))
            {
                return ServiceResult<StationResponse>.Fail(
                    ServiceError.Validation,
                    "Status must be one of Active, Inactive or Maintenance.",
                    new { status = request.Status });
            }
        }

        var stationCode = request.StationCode.Trim().ToUpperInvariant();

        if (await _repository.StationCodeExistsAsync(stationCode, excludingId: null, cancellationToken))
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.DuplicateStationCode,
                $"A station with code '{stationCode}' already exists.",
                new { stationCode });
        }

        var now = DateTime.UtcNow;
        var station = new SolarStationInfo
        {
            StationCode = stationCode,
            Name = request.Name.Trim(),
            Description = Normalise(request.Description),
            AddressLine = Normalise(request.AddressLine),
            Latitude = request.Latitude.Value,
            Longitude = request.Longitude.Value,
            CapacityKWh = Math.Round(request.CapacityKWh!.Value, 2),
            TotalBatterySlots = request.TotalBatterySlots.Value,
            AvailableBatterySlots = request.AvailableBatterySlots.Value,
            Status = status,
            OperationalSchedule = StationMapper.ToScheduleEntities(request.OperationalSchedule),
            ContactPhone = Normalise(request.ContactPhone),
            // Audit values are set here, never taken from the request.
            CreatedAtUtc = now,
            CreatedByUserId = userId,
            DeactivatedAtUtc = status == StationStatus.Inactive ? now : null
        };

        try
        {
            await _repository.CreateAsync(station, cancellationToken);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            // The unique index caught a race the pre-check could not.
            return ServiceResult<StationResponse>.Fail(
                ServiceError.DuplicateStationCode,
                $"A station with code '{stationCode}' already exists.",
                new { stationCode });
        }

        _logger.LogInformation("Station {StationCode} created with id {StationId} by {UserId}.",
            station.StationCode, station.Id, userId);

        return ServiceResult<StationResponse>.Ok(
            StationMapper.ToFullResponse(station, _schedule.IsOpenNow(station.OperationalSchedule)));
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    public async Task<ServiceResult<StationResponse>> GetByIdAsync(
        string id, CancellationToken cancellationToken = default)
    {
        if (!IsValidObjectId(id))
        {
            return ServiceResult<StationResponse>.Fail(ServiceError.Validation, "Station id is not a valid identifier.");
        }

        // Staff see every station whatever its status: hiding inactive nodes is
        // a rule of the public view, enforced in GetPublicDetailAsync.
        var station = await _repository.GetByIdAsync(id, cancellationToken);
        if (station is null)
        {
            return NotFound<StationResponse>(id);
        }

        return ServiceResult<StationResponse>.Ok(
            StationMapper.ToFullResponse(station, _schedule.IsOpenNow(station.OperationalSchedule)));
    }

    public async Task<ServiceResult<PagedResponse<StationSummaryResponse>>> GetPagedAsync(
        StationListQuery query, CancellationToken cancellationToken = default)
    {
        StationStatus? status = null;
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            if (!Enum.TryParse<StationStatus>(query.Status, ignoreCase: true, out var parsed))
            {
                return ServiceResult<PagedResponse<StationSummaryResponse>>.Fail(
                    ServiceError.Validation,
                    "Status must be one of Active, Inactive or Maintenance.",
                    new { status = query.Status });
            }

            status = parsed;
        }

        // An unrecognised sort field is rejected rather than quietly ignored: a
        // client sorting by a field that does not exist is a bug worth surfacing.
        if (!AllowedSortFields.Contains(query.SortBy))
        {
            return ServiceResult<PagedResponse<StationSummaryResponse>>.Fail(
                ServiceError.Validation,
                "SortBy must be one of name, createdAtUtc or stationCode.",
                new { sortBy = query.SortBy });
        }

        if (!string.Equals(query.SortDir, "asc", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(query.SortDir, "desc", StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<PagedResponse<StationSummaryResponse>>.Fail(
                ServiceError.Validation,
                "SortDir must be either asc or desc.",
                new { sortDir = query.SortDir });
        }

        var ascending = string.Equals(query.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        var canonicalSort = AllowedSortFields.First(f => f.Equals(query.SortBy, StringComparison.OrdinalIgnoreCase));

        var (items, totalCount) = await _repository.GetPagedAsync(
            status, query.Search, query.Page, query.PageSize, canonicalSort, ascending, cancellationToken);

        return ServiceResult<PagedResponse<StationSummaryResponse>>.Ok(new PagedResponse<StationSummaryResponse>
        {
            Items = items.Select(StationMapper.ToSummary).ToList(),
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)query.PageSize)
        });
    }

    // ── Update ───────────────────────────────────────────────────────────────

    public async Task<ServiceResult<StationResponse>> UpdateAsync(
        string id, UpdateStationRequest request, string userId, bool isBackoffice,
        CancellationToken cancellationToken = default)
    {
        if (!IsValidObjectId(id))
        {
            return ServiceResult<StationResponse>.Fail(ServiceError.Validation, "Station id is not a valid identifier.");
        }

        var station = await _repository.GetByIdAsync(id, cancellationToken);
        if (station is null)
        {
            return NotFound<StationResponse>(id);
        }

        // The code is printed on labels and quoted in support calls, so it may
        // not change. Supplying a different one is an error, not a no-op.
        if (!string.IsNullOrWhiteSpace(request.StationCode)
            && !string.Equals(request.StationCode.Trim(), station.StationCode, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.StationCodeImmutable,
                "Station code cannot be changed after the station has been created.",
                new { currentStationCode = station.StationCode, submittedStationCode = request.StationCode.Trim() });
        }

        var coordinateError = ValidateCoordinates(request.Latitude!.Value, request.Longitude!.Value);
        if (coordinateError is not null)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.Validation, coordinateError, BuildCoordinateDetails(request.Latitude, request.Longitude));
        }

        if (request.AvailableBatterySlots!.Value > request.TotalBatterySlots!.Value)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.SlotInvariantViolated,
                "Available battery slots cannot exceed total battery slots.",
                new
                {
                    totalBatterySlots = request.TotalBatterySlots,
                    availableBatterySlots = request.AvailableBatterySlots
                });
        }

        var scheduleResult = ValidateSchedule(request.OperationalSchedule);
        if (!scheduleResult.Succeeded)
        {
            return ServiceResult<StationResponse>.Fail(scheduleResult);
        }

        // A Grid Operator runs a station day to day; it does not get to move it,
        // rename it, or change its rated capacity. Route-level role attributes
        // cannot express a per-field rule, so it is enforced here.
        if (!isBackoffice)
        {
            var restricted = FindRestrictedFieldChanges(station, request);
            if (restricted.Count > 0)
            {
                return ServiceResult<StationResponse>.Fail(
                    ServiceError.Forbidden,
                    "Your role may update only available battery slots, contact phone and the operational schedule.",
                    new { restrictedFields = restricted });
            }
        }

        station.Name = request.Name.Trim();
        station.Description = Normalise(request.Description);
        station.AddressLine = Normalise(request.AddressLine);
        station.Latitude = request.Latitude.Value;
        station.Longitude = request.Longitude.Value;
        station.CapacityKWh = Math.Round(request.CapacityKWh!.Value, 2);
        station.TotalBatterySlots = request.TotalBatterySlots.Value;
        station.AvailableBatterySlots = request.AvailableBatterySlots.Value;
        station.OperationalSchedule = StationMapper.ToScheduleEntities(request.OperationalSchedule);
        station.ContactPhone = Normalise(request.ContactPhone);
        station.UpdatedAtUtc = DateTime.UtcNow;
        station.UpdatedByUserId = userId;

        var replaced = await _repository.ReplaceAsync(station, cancellationToken);
        if (!replaced)
        {
            // Deleted between the read and the write.
            return NotFound<StationResponse>(id);
        }

        _logger.LogInformation("Station {StationId} updated by {UserId}.", id, userId);

        return ServiceResult<StationResponse>.Ok(
            StationMapper.ToFullResponse(station, _schedule.IsOpenNow(station.OperationalSchedule)));
    }

    // ── Deactivate / activate ────────────────────────────────────────────────

    public async Task<ServiceResult<StationResponse>> DeactivateAsync(
        string id, string? reason, string userId, CancellationToken cancellationToken = default)
    {
        if (!IsValidObjectId(id))
        {
            return ServiceResult<StationResponse>.Fail(ServiceError.Validation, "Station id is not a valid identifier.");
        }

        var station = await _repository.GetByIdAsync(id, cancellationToken);
        if (station is null)
        {
            return NotFound<StationResponse>(id);
        }

        // Checked before the reservation call so a no-op request does not pay for
        // a cross-module query.
        if (station.Status == StationStatus.Inactive)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.AlreadyInactive,
                "This station is already inactive.",
                new { currentStatus = station.Status.ToString(), deactivatedAtUtc = station.DeactivatedAtUtc });
        }

        int activeReservations;
        try
        {
            activeReservations = await _reservations.GetActiveReservationCountAsync(id, cancellationToken);
        }
        catch (Exception ex)
        {
            // Fail closed. Deactivating a station whose reservation state is
            // unknown could strand a prosumer who has already set out for it.
            _logger.LogError(ex,
                "Reservation availability check failed for station {StationId}; refusing to deactivate.", id);

            return ServiceResult<StationResponse>.Fail(
                ServiceError.ReservationServiceUnavailable,
                "Cannot verify reservations at this time. Please try again.");
        }

        if (activeReservations > 0)
        {
            _logger.LogInformation(
                "Deactivation of station {StationId} blocked by {Count} active reservation(s).", id, activeReservations);

            return ServiceResult<StationResponse>.Fail(
                ServiceError.HasActiveReservations,
                $"This station cannot be deactivated while {activeReservations} active reservation(s) exist.",
                new { stationId = id, activeReservationCount = activeReservations });
        }

        var now = DateTime.UtcNow;
        var trimmedReason = Normalise(reason);

        // Conditional on the status we read, so two simultaneous deactivations
        // cannot both report success.
        var changed = await _repository.TryChangeStatusAsync(
            id, station.Status, StationStatus.Inactive, now, trimmedReason, userId, now, cancellationToken);

        if (!changed)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.AlreadyInactive,
                "This station is already inactive.",
                new { currentStatus = StationStatus.Inactive.ToString() });
        }

        station.Status = StationStatus.Inactive;
        station.DeactivatedAtUtc = now;
        station.DeactivationReason = trimmedReason;
        station.UpdatedAtUtc = now;
        station.UpdatedByUserId = userId;

        _logger.LogInformation("Station {StationId} deactivated by {UserId}.", id, userId);

        return ServiceResult<StationResponse>.Ok(
            StationMapper.ToFullResponse(station, _schedule.IsOpenNow(station.OperationalSchedule)));
    }

    public async Task<ServiceResult<StationResponse>> ActivateAsync(
        string id, string userId, CancellationToken cancellationToken = default)
    {
        if (!IsValidObjectId(id))
        {
            return ServiceResult<StationResponse>.Fail(ServiceError.Validation, "Station id is not a valid identifier.");
        }

        var station = await _repository.GetByIdAsync(id, cancellationToken);
        if (station is null)
        {
            return NotFound<StationResponse>(id);
        }

        if (station.Status == StationStatus.Active)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.AlreadyActive,
                "This station is already active.",
                new { currentStatus = station.Status.ToString() });
        }

        // No reservation check here: bringing a station back into service
        // conflicts with nothing.
        var now = DateTime.UtcNow;
        var changed = await _repository.TryChangeStatusAsync(
            id, station.Status, StationStatus.Active,
            deactivatedAtUtc: null, deactivationReason: null, userId, now, cancellationToken);

        if (!changed)
        {
            return ServiceResult<StationResponse>.Fail(
                ServiceError.AlreadyActive,
                "This station is already active.",
                new { currentStatus = StationStatus.Active.ToString() });
        }

        station.Status = StationStatus.Active;
        station.DeactivatedAtUtc = null;
        station.DeactivationReason = null;
        station.UpdatedAtUtc = now;
        station.UpdatedByUserId = userId;

        _logger.LogInformation("Station {StationId} reactivated by {UserId}.", id, userId);

        return ServiceResult<StationResponse>.Ok(
            StationMapper.ToFullResponse(station, _schedule.IsOpenNow(station.OperationalSchedule)));
    }

    public async Task<ServiceResult<DeactivationEligibilityResponse>> GetDeactivationEligibilityAsync(
        string id, CancellationToken cancellationToken = default)
    {
        if (!IsValidObjectId(id))
        {
            return ServiceResult<DeactivationEligibilityResponse>.Fail(
                ServiceError.Validation, "Station id is not a valid identifier.");
        }

        var station = await _repository.GetByIdAsync(id, cancellationToken);
        if (station is null)
        {
            return NotFound<DeactivationEligibilityResponse>(id);
        }

        if (station.Status == StationStatus.Inactive)
        {
            return ServiceResult<DeactivationEligibilityResponse>.Ok(new DeactivationEligibilityResponse
            {
                StationId = id,
                CanDeactivate = false,
                ActiveReservationCount = 0,
                Reason = "This station is already inactive."
            });
        }

        int activeReservations;
        try
        {
            activeReservations = await _reservations.GetActiveReservationCountAsync(id, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Reservation availability check failed for station {StationId}.", id);

            return ServiceResult<DeactivationEligibilityResponse>.Fail(
                ServiceError.ReservationServiceUnavailable,
                "Cannot verify reservations at this time. Please try again.");
        }

        return ServiceResult<DeactivationEligibilityResponse>.Ok(new DeactivationEligibilityResponse
        {
            StationId = id,
            CanDeactivate = activeReservations == 0,
            ActiveReservationCount = activeReservations,
            Reason = activeReservations > 0
                ? $"{activeReservations} active reservation(s) are associated with this station."
                : null
        });
    }

    // ── Location / mobile ────────────────────────────────────────────────────

    public async Task<ServiceResult<List<StationMapSummaryResponse>>> GetNearbyAsync(
        NearbyStationQuery query, CancellationToken cancellationToken = default)
    {
        var latitude = query.Latitude!.Value;
        var longitude = query.Longitude!.Value;

        var coordinateError = ValidateCoordinates(latitude, longitude, allowNullIsland: true);
        if (coordinateError is not null)
        {
            return ServiceResult<List<StationMapSummaryResponse>>.Fail(
                ServiceError.Validation, coordinateError, BuildCoordinateDetails(latitude, longitude));
        }

        // Narrow in the database with a box, then apply the exact circular test
        // in memory — a box always contains the circle, so nothing is lost.
        var (minLat, maxLat, minLon, maxLon) = GeoCalculator.BoundingBox(latitude, longitude, query.RadiusKm);

        var candidates = await _repository.GetActiveStationsInBoundingBoxAsync(
            minLat, maxLat, minLon, maxLon, cancellationToken);

        var now = DateTime.UtcNow;

        var results = candidates
            .Select(station => new
            {
                Station = station,
                DistanceKm = GeoCalculator.DistanceKm(latitude, longitude, station.Latitude, station.Longitude)
            })
            .Where(x => x.DistanceKm <= query.RadiusKm)
            .OrderBy(x => x.DistanceKm)
            .Take(query.Limit)
            .Select(x => StationMapper.ToMapSummary(
                x.Station, x.DistanceKm, _schedule.IsOpenAt(x.Station.OperationalSchedule, now)))
            .ToList();

        // An empty result is a valid answer ("nothing near you"), not a 404.
        return ServiceResult<List<StationMapSummaryResponse>>.Ok(results);
    }

    public async Task<ServiceResult<StationDetailResponse>> GetPublicDetailAsync(
        string id, CancellationToken cancellationToken = default)
    {
        if (!IsValidObjectId(id))
        {
            return ServiceResult<StationDetailResponse>.Fail(
                ServiceError.Validation, "Station id is not a valid identifier.");
        }

        var station = await _repository.GetByIdAsync(id, cancellationToken);

        // Inactive stations are absent from the public view, not forbidden.
        if (station is null || station.Status != StationStatus.Active)
        {
            return NotFound<StationDetailResponse>(id);
        }

        return ServiceResult<StationDetailResponse>.Ok(
            StationMapper.ToPublicDetail(station, _schedule.IsOpenNow(station.OperationalSchedule)));
    }

    public async Task<ServiceResult<List<StationLookupResponse>>> GetLookupAsync(
        CancellationToken cancellationToken = default)
    {
        var stations = await _repository.GetActiveStationsAsync(cancellationToken);

        return ServiceResult<List<StationLookupResponse>>.Ok(
            stations.Select(StationMapper.ToLookup).ToList());
    }

    // ── Validation helpers ───────────────────────────────────────────────────

    /// <summary>
    /// Range checks beyond the attribute bounds. (0, 0) is a real point in the
    /// Gulf of Guinea but in practice means "nobody filled the field in", so it
    /// is rejected when registering a station — though not when searching, where
    /// it is a legitimate query point.
    /// </summary>
    private static string? ValidateCoordinates(double latitude, double longitude, bool allowNullIsland = false)
    {
        if (double.IsNaN(latitude) || double.IsInfinity(latitude) ||
            double.IsNaN(longitude) || double.IsInfinity(longitude))
        {
            return "Latitude and longitude must be finite numbers.";
        }

        if (latitude is < -90 or > 90 || longitude is < -180 or > 180)
        {
            return "Latitude must be between -90 and 90 and longitude between -180 and 180.";
        }

        if (!allowNullIsland && Math.Abs(latitude) < double.Epsilon && Math.Abs(longitude) < double.Epsilon)
        {
            return "Coordinates (0, 0) are not a valid station location. Please set the station's GPS position.";
        }

        return null;
    }

    private static object BuildCoordinateDetails(double? latitude, double? longitude) =>
        new { latitude, longitude };

    /// <summary>
    /// Schedule rules that the per-field attributes cannot express: one entry per
    /// day, and a window that actually has width.
    /// </summary>
    private static ServiceResult ValidateSchedule(List<ScheduleEntryDto>? schedule)
    {
        if (schedule is null || schedule.Count == 0)
        {
            return ServiceResult.Success();
        }

        if (schedule.Count > 7)
        {
            return ServiceResult.Failure(
                ServiceError.InvalidSchedule,
                "The operational schedule cannot contain more than seven entries.");
        }

        var seenDays = new HashSet<DayOfWeek>();

        foreach (var entry in schedule)
        {
            if (!Enum.TryParse<DayOfWeek>(entry.DayOfWeek, ignoreCase: true, out var day))
            {
                return ServiceResult.Failure(
                    ServiceError.InvalidSchedule,
                    $"'{entry.DayOfWeek}' is not a valid day of the week.",
                    new { dayOfWeek = entry.DayOfWeek });
            }

            if (!seenDays.Add(day))
            {
                return ServiceResult.Failure(
                    ServiceError.InvalidSchedule,
                    $"The operational schedule contains more than one entry for {day}.",
                    new { dayOfWeek = day.ToString() });
            }

            // A day marked closed carries no meaningful window.
            if (entry.IsClosed)
            {
                continue;
            }

            if (!ScheduleEvaluator.TryParseTime(entry.OpenTime, out var open)
                || !ScheduleEvaluator.TryParseTime(entry.CloseTime, out var close))
            {
                return ServiceResult.Failure(
                    ServiceError.InvalidSchedule,
                    $"Opening hours for {day} must be valid times in HH:mm format.",
                    new { dayOfWeek = day.ToString(), openTime = entry.OpenTime, closeTime = entry.CloseTime });
            }

            if (close <= open)
            {
                return ServiceResult.Failure(
                    ServiceError.InvalidSchedule,
                    $"Closing time must be later than opening time for {day}.",
                    new { dayOfWeek = day.ToString(), openTime = entry.OpenTime, closeTime = entry.CloseTime });
            }
        }

        return ServiceResult.Success();
    }

    /// <summary>
    /// Names the fields a non-Backoffice caller tried to change. Comparing values
    /// rather than presence means resubmitting the whole form unchanged is fine.
    /// </summary>
    private static List<string> FindRestrictedFieldChanges(SolarStationInfo station, UpdateStationRequest request)
    {
        var changed = new List<string>();

        if (!string.Equals(station.Name, request.Name.Trim(), StringComparison.Ordinal))
        {
            changed.Add(nameof(request.Name));
        }

        if (!string.Equals(Normalise(request.Description), station.Description, StringComparison.Ordinal))
        {
            changed.Add(nameof(request.Description));
        }

        if (!string.Equals(Normalise(request.AddressLine), station.AddressLine, StringComparison.Ordinal))
        {
            changed.Add(nameof(request.AddressLine));
        }

        if (Math.Abs(station.Latitude - request.Latitude!.Value) > 1e-9)
        {
            changed.Add(nameof(request.Latitude));
        }

        if (Math.Abs(station.Longitude - request.Longitude!.Value) > 1e-9)
        {
            changed.Add(nameof(request.Longitude));
        }

        if (Math.Abs(station.CapacityKWh - Math.Round(request.CapacityKWh!.Value, 2)) > 1e-9)
        {
            changed.Add(nameof(request.CapacityKWh));
        }

        if (station.TotalBatterySlots != request.TotalBatterySlots!.Value)
        {
            changed.Add(nameof(request.TotalBatterySlots));
        }

        return changed;
    }

    private static ServiceResult<T> NotFound<T>(string id) =>
        ServiceResult<T>.Fail(
            ServiceError.NotFound,
            "No station exists with the specified identifier.",
            new { stationId = id });

    private static bool IsValidObjectId(string? id) =>
        !string.IsNullOrWhiteSpace(id) && ObjectId.TryParse(id, out _);

    /// <summary>Trims, and turns a blank string into null so absent and empty agree.</summary>
    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
