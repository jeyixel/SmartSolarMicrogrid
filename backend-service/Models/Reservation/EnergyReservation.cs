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
public class EnergyReservation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// National Identity Card number of the prosumer.
    /// Primary identifier for the solar panel owner making the reservation.
    /// </summary>
    public string ProsumerNIC { get; set; } = string.Empty;

    /// <summary>
    /// Foreign key referencing EnergyBookingSlot.Id.
    /// Links this reservation to the physical time slot at the microgrid hub.
    /// </summary>
    [BsonRepresentation(BsonType.ObjectId)]
    public string SlotId { get; set; } = string.Empty;

    /// <summary>
    /// Lifecycle status of this reservation.
    /// Allowed values: "Pending" | "Completed" | "Cancelled"
    /// </summary>
    public string Status { get; set; } = "Pending";

    /// <summary>User ID of the operator who created this reservation (audit trail).</summary>
    public string CreatedByUserId { get; set; } = string.Empty;

    /// <summary>User ID of the operator who last modified this reservation (audit trail).</summary>
    public string UpdatedByUserId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
