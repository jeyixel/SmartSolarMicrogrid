namespace backend_service.Infrastructure;

/// <summary>
/// Why a service operation did not succeed. Expected outcomes are returned, not
/// thrown: "this station has reservations" is a normal answer, not an exception.
/// </summary>
public enum ServiceError
{
    None = 0,
    NotFound,
    Validation,
    DuplicateStationCode,
    StationCodeImmutable,
    SlotInvariantViolated,
    InvalidSchedule,
    AlreadyInactive,
    AlreadyActive,
    HasActiveReservations,
    ReservationServiceUnavailable,
    Forbidden
}

/// <summary>Outcome of a service call that returns no value.</summary>
public class ServiceResult
{
    public bool Succeeded => Error == ServiceError.None;

    public ServiceError Error { get; protected init; } = ServiceError.None;

    /// <summary>Overrides the default message for the error code.</summary>
    public string? Message { get; protected init; }

    /// <summary>Extra context carried into the error envelope's <c>details</c>.</summary>
    public object? Details { get; protected init; }

    public static ServiceResult Success() => new();

    public static ServiceResult Failure(ServiceError error, string? message = null, object? details = null) =>
        new() { Error = error, Message = message, Details = details };
}

/// <summary>Outcome of a service call that returns a value on success.</summary>
public sealed class ServiceResult<T> : ServiceResult
{
    public T? Value { get; private init; }

    public static ServiceResult<T> Ok(T value) => new() { Value = value };

    /// <summary>
    /// Named differently from <see cref="ServiceResult.Failure"/> rather than
    /// shadowing it, so a call on the generic type cannot silently bind to the
    /// non-generic overload and fail to compile in a confusing way.
    /// </summary>
    public static ServiceResult<T> Fail(ServiceError error, string? message = null, object? details = null) =>
        new() { Error = error, Message = message, Details = details };

    /// <summary>Carries a non-generic failure through to a typed result.</summary>
    public static ServiceResult<T> Fail(ServiceResult failure) =>
        new() { Error = failure.Error, Message = failure.Message, Details = failure.Details };
}
