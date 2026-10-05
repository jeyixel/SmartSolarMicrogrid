using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

/// <summary>
/// Represents a physical time slot at a microgrid hub.
/// Tracks when a battery slot is available at a specific SolarStationInfo node,
/// the energy capacity on offer, and whether the slot is for Drop-off or Charging.
/// Relates to EnergyReservation via EnergyReservation.SlotId → EnergyBookingSlot.Id.
/// </summary>
[BsonIgnoreExtraElements]
public class EnergyBookingSlot
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string SlotCode { get; set; } = string.Empty;

    public string StationId { get; set; } = string.Empty;

    public string StationName { get; set; } = string.Empty;

    public DateTime SlotDate { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    /// <summary>
    /// Allowed values: "Charging" | "Discharging" | "BatterySwap" (or "Drop-off")
    /// </summary>
    public string TradeType { get; set; } = "Charging";

    public double TotalCapacityKWh { get; set; }

    public int TotalBatterySlots { get; set; }

    public int BookedBatterySlots { get; set; }

    public int AvailableBatterySlots => TotalBatterySlots - BookedBatterySlots;

    /// <summary>
    /// Allowed values: "Open" | "Full" | "Closed" | "Expired"
    /// </summary>
    public string Status { get; set; } = "Open";

    public string CreatedByUserId { get; set; } = string.Empty;

    public string UpdatedByUserId { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
