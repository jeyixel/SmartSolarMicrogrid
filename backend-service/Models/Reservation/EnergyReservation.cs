using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

/// <summary>
/// Represents a prosumer's appointment at a microgrid hub.
/// Links a prosumer (identified by NIC) to a physical EnergyBookingSlot.
/// Business rules enforced via EnergyReservationService:
///   - 7-Day Scheduling Rule: slot must start within the next 7 days.
///   - 12-Hour Rule: modifications/cancellations blocked within 12 hours of slot start.
/// </summary>
[BsonIgnoreExtraElements]
public class EnergyReservation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string ReservationCode { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.ObjectId)]
    public string SlotId { get; set; } = string.Empty;

    public string StationId { get; set; } = string.Empty;

    public string StationName { get; set; } = string.Empty;

    public DateTime SlotStartTime { get; set; }

    public DateTime SlotEndTime { get; set; }

    public string ProsumerNIC { get; set; } = string.Empty;

    public string ProsumerName { get; set; } = string.Empty;

    public double RequestedKWh { get; set; }

    /// <summary>
    /// Lifecycle status of this reservation.
    /// Allowed values: "Pending" | "Approved" | "CheckedIn" | "Completed" | "Cancelled" | "Rejected"
    /// </summary>
    public string Status { get; set; } = "Pending";

    public string? QrCodeToken { get; set; }
    
    public DateTime? QrCodeGeneratedAtUtc { get; set; }

    public DateTime? QrCodeVerifiedAtUtc { get; set; }

    public string? QrCodeVerifiedByUserId { get; set; }

    public DateTime ReservationCreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime LastModifiedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? CancelledAtUtc { get; set; }

    public string? CancelledByUserId { get; set; }

    public string? CancellationReason { get; set; }

    public string CreatedByUserId { get; set; } = string.Empty;

    public string UpdatedByUserId { get; set; } = string.Empty;
}
