namespace backend_service.DTOs;

/// <summary>
/// Payload supplied when an operator or backoffice admin rejects a pending reservation.
/// </summary>
public class RejectReservationRequestDto
{
    /// <summary>
    /// Optional or required reason why the reservation was rejected.
    /// </summary>
    public string? Reason { get; set; }
}
