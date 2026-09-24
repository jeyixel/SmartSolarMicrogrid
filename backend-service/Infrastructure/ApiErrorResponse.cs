namespace backend_service.Infrastructure;

/// <summary>
/// The single error shape every non-2xx response from this module uses, so both
/// clients can write one error handler.
/// </summary>
public sealed class ApiErrorResponse
{
    public bool Success => false;

    /// <summary>Stable machine-readable code. Clients branch on this, not on the message.</summary>
    public string ErrorCode { get; set; } = ErrorCodes.InternalError;

    /// <summary>Human-readable sentence. Safe to reword without breaking clients.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Structured context for this particular failure; shape varies by code.</summary>
    public object? Details { get; set; }

    /// <summary>Correlation id, so a reported failure can be found in the logs.</summary>
    public string? TraceId { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

/// <summary>Every error code this module can return.</summary>
public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string InvalidCoordinates = "INVALID_COORDINATES";
    public const string StationNotFound = "STATION_NOT_FOUND";
    public const string DuplicateStationCode = "DUPLICATE_STATION_CODE";
    public const string StationCodeImmutable = "STATION_CODE_IMMUTABLE";
    public const string SlotInvariantViolated = "SLOT_INVARIANT_VIOLATED";
    public const string InvalidSchedule = "INVALID_SCHEDULE";
    public const string StationAlreadyInactive = "STATION_ALREADY_INACTIVE";
    public const string StationAlreadyActive = "STATION_ALREADY_ACTIVE";
    public const string StationHasActiveReservations = "STATION_HAS_ACTIVE_RESERVATIONS";
    public const string ReservationServiceUnavailable = "RESERVATION_SERVICE_UNAVAILABLE";
    public const string ForbiddenOperation = "FORBIDDEN_OPERATION";
    public const string InternalError = "INTERNAL_ERROR";
}
