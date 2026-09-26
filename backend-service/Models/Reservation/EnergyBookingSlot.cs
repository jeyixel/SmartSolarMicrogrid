using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

/// <summary>
/// Represents a physical time slot at a microgrid hub.
/// Tracks when a battery slot is available at a specific SolarStationInfo node,
/// the energy capacity on offer, and whether the slot is for Drop-off or Charging.
/// Relates to EnergyReservation via EnergyReservation.SlotId → EnergyBookingSlot.Id.
/// 
/// Decorated with [BsonIgnoreExtraElements] to safely handle database evolution
/// and legacy documents that may contain fields from earlier iterations.
/// </summary>
[BsonIgnoreExtraElements]
public class EnergyBookingSlot
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Prosumer's NIC (National Identity Card number).
    /// Primary key for the user booking the slot.
    /// </summary>
    public string ProsumerNIC { get; set; } = string.Empty;

    /// <summary>
    /// Foreign key referencing SolarStationInfo.StationCode (e.g. "CMB-NORTH-01").
    /// </summary>
    public string StationId { get; set; } = string.Empty;

    /// <summary>
    /// Backward-compatibility mapping for legacy documents that used "GridNodeId".
    /// Automatically populates StationId when reading older MongoDB documents.
    /// Not written back to database on new inserts.
    /// </summary>
    [BsonElement("GridNodeId")]
    [BsonIgnoreIfNull]
    public string? GridNodeId
    {
        get => null;
        set
        {
            if (!string.IsNullOrEmpty(value) && string.IsNullOrEmpty(StationId))
            {
                StationId = value;
            }
        }
    }

    /// <summary>UTC start time of this physical battery slot window.</summary>
    public DateTime StartTime { get; set; }

    /// <summary>UTC end time of this physical battery slot window.</summary>
    public DateTime EndTime { get; set; }

    /// <summary>Energy capacity allocated to this slot in kilowatt-hours.</summary>
    public double EnergyAmountKWh { get; set; }

    /// <summary>
    /// Backward-compatibility mapping for legacy documents that used "AvailableCapacity".
    /// Automatically populates EnergyAmountKWh when reading older MongoDB documents.
    /// Not written back to database on new inserts.
    /// </summary>
    [BsonElement("AvailableCapacity")]
    [BsonIgnoreIfNull]
    public double? AvailableCapacity
    {
        get => null;
        set
        {
            if (value.HasValue && EnergyAmountKWh == 0)
            {
                EnergyAmountKWh = value.Value;
            }
        }
    }

    /// <summary>
    /// Whether this slot is configured for energy export or import.
    /// Allowed values: "Drop-off" | "Charge"
    /// </summary>
    public string ActionType { get; set; } = "Drop-off";

    /// <summary>
    /// Physical availability of this slot.
    /// Allowed values: "Available" | "Booked" | "Maintenance" | "Pending" | "Completed" | "Cancelled"
    /// </summary>
    public string Status { get; set; } = "Available";

    /// <summary>User ID of the operator who created this slot (audit trail).</summary>
    public string CreatedByUserId { get; set; } = string.Empty;

    /// <summary>User ID of the operator who last modified this slot (audit trail).</summary>
    public string UpdatedByUserId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
