using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace backend_service.Infrastructure;

/// <summary>
/// The single place where a business outcome becomes an HTTP status code. Having
/// one mapping keeps the controllers free of decisions and stops two endpoints
/// answering the same failure differently.
/// </summary>
public static class ServiceResultExtensions
{
    public static IActionResult ToErrorResult(this ServiceResult result, HttpContext httpContext)
    {
        var (statusCode, errorCode, defaultMessage) = Map(result.Error);

        var payload = new ApiErrorResponse
        {
            ErrorCode = errorCode,
            Message = result.Message ?? defaultMessage,
            Details = result.Details,
            TraceId = httpContext.TraceIdentifier
        };

        return new ObjectResult(payload) { StatusCode = statusCode };
    }

    private static (int StatusCode, string ErrorCode, string Message) Map(ServiceError error) => error switch
    {
        ServiceError.NotFound => (
            StatusCodes.Status404NotFound,
            ErrorCodes.StationNotFound,
            "No station exists with the specified identifier."),

        ServiceError.Validation => (
            StatusCodes.Status400BadRequest,
            ErrorCodes.ValidationError,
            "One or more fields are invalid."),

        ServiceError.DuplicateStationCode => (
            StatusCodes.Status409Conflict,
            ErrorCodes.DuplicateStationCode,
            "A station with this code already exists."),

        ServiceError.StationCodeImmutable => (
            StatusCodes.Status409Conflict,
            ErrorCodes.StationCodeImmutable,
            "Station code cannot be changed after creation."),

        ServiceError.SlotInvariantViolated => (
            StatusCodes.Status409Conflict,
            ErrorCodes.SlotInvariantViolated,
            "Available battery slots cannot exceed total battery slots."),

        ServiceError.InvalidSchedule => (
            StatusCodes.Status409Conflict,
            ErrorCodes.InvalidSchedule,
            "The operational schedule is not valid."),

        ServiceError.AlreadyInactive => (
            StatusCodes.Status409Conflict,
            ErrorCodes.StationAlreadyInactive,
            "This station is already inactive."),

        ServiceError.AlreadyActive => (
            StatusCodes.Status409Conflict,
            ErrorCodes.StationAlreadyActive,
            "This station is already active."),

        ServiceError.HasActiveReservations => (
            StatusCodes.Status409Conflict,
            ErrorCodes.StationHasActiveReservations,
            "This station cannot be deactivated while active reservations exist."),

        // Fail-closed: the reservation module could not be reached, so the
        // request is deferred rather than guessed at.
        ServiceError.ReservationServiceUnavailable => (
            StatusCodes.Status503ServiceUnavailable,
            ErrorCodes.ReservationServiceUnavailable,
            "Cannot verify reservations at this time. Please try again."),

        ServiceError.Forbidden => (
            StatusCodes.Status403Forbidden,
            ErrorCodes.ForbiddenOperation,
            "Your role is not permitted to perform this operation."),

        _ => (
            StatusCodes.Status500InternalServerError,
            ErrorCodes.InternalError,
            "An unexpected error occurred while processing the request.")
    };
}
