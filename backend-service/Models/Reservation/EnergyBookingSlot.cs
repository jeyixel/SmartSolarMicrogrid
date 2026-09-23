using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

/// <summary>
/// Represents a physical time slot at a microgrid hub.
/// Tracks when a battery slot is available at a specific SolarStationInfo node,
/// the energy capacity on offer, and whether the slot is for Drop-off or Charging.
/// Relates to EnergyReservation via EnergyReservation.SlotId → EnergyBookingSlot.Id.
/// </summary>
public class EnergyBookingSlot
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Foreign key referencing SolarStationInfo.StationCode (e.g. "CMB-NORTH-01").
    /// </summary>
    public string StationId { get; set; } = string.Empty;

    /// <summary>UTC start time of this physical battery slot window.</summary>
    public DateTime StartTime { get; set; }

    /// <summary>UTC end time of this physical battery slot window.</summary>
    public DateTime EndTime { get; set; }

    /// <summary>Energy capacity allocated to this slot in kilowatt-hours.</summary>
    public double EnergyAmountKWh { get; set; }

    /// <summary>
    /// Whether this slot is configured for energy export or import.
    /// Allowed values: "Drop-off" | "Charge"
    /// </summary>
    public string ActionType { get; set; } = string.Empty;

    /// <summary>
    /// Physical availability of this slot.
    /// Allowed values: "Available" | "Booked" | "Maintenance"
    /// </summary>
    public string Status { get; set; } = "Available";

    /// <summary>User ID of the operator who created this slot (audit trail).</summary>
    public string CreatedByUserId { get; set; } = string.Empty;

    /// <summary>User ID of the operator who last modified this slot (audit trail).</summary>
    public string UpdatedByUserId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
