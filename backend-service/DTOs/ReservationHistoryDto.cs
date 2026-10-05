/*
 * Student Component: Member 4 - Grid Operations, QR & Dashboards
 * File Purpose: Data transfer object for rich booking history records with linked slot metadata
 */

namespace backend_service.DTOs;

public class ReservationHistoryDto
{
    public string Id { get; set; } = string.Empty;
    public string ProsumerNIC { get; set; } = string.Empty;
    public string SlotId { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public double EnergyAmountKWh { get; set; }
    public string ActionType { get; set; } = "Drop-off";
    public string Status { get; set; } = "Pending";
    public string? QrToken { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
