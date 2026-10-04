namespace backend_service.DTOs;

/// <summary>
/// Result of verifying and finalizing an on-site energy transfer session via QR code.
/// </summary>
public class EnergyTransferResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string ReservationId { get; set; } = string.Empty;
    public string ReservationCode { get; set; } = string.Empty;
    public string ProsumerNIC { get; set; } = string.Empty;
    public string ProsumerName { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public double TransferredKWh { get; set; }
    public string ActionType { get; set; } = "Charging";
    public string PreviousStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = "Completed";
    public DateTime VerifiedAtUtc { get; set; } = DateTime.UtcNow;
}
