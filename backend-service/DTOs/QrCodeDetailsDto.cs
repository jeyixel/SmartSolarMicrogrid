namespace backend_service.DTOs;

/// <summary>
/// Response payload for a generated reservation QR code.
/// Contains the scannable token and the session details required for on-site verification.
/// </summary>
public class QrCodeDetailsDto
{
    public string ReservationId { get; set; } = string.Empty;
    public string ReservationCode { get; set; } = string.Empty;
    public string QrCodeToken { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string ProsumerNIC { get; set; } = string.Empty;
    public string ProsumerName { get; set; } = string.Empty;
    public DateTime SlotStartTime { get; set; }
    public DateTime SlotEndTime { get; set; }
    public double RequestedKWh { get; set; }
    public string ActionType { get; set; } = "Charging";
    public string Status { get; set; } = "Pending";
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
}
