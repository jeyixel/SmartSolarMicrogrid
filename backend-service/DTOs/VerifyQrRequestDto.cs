namespace backend_service.DTOs;

/// <summary>
/// Request payload sent by Grid Operator to verify a scanned prosumer QR pass.
/// </summary>
public class VerifyQrRequestDto
{
    public string QrToken { get; set; } = string.Empty;
    public string? StationId { get; set; }
    public string? OperatorUserId { get; set; }
}
