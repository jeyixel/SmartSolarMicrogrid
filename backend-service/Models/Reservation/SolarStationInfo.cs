using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

/// <summary>
/// Represents a maintenance blackout window or a regular operational schedule item
/// for a microgrid station.
/// Stored within SolarStationInfo.OperationalSchedule array in MongoDB.
/// </summary>
[BsonIgnoreExtraElements]
public class OperationalScheduleBlock
{
    /// <summary>UTC start of the maintenance or operational window.</summary>
    [BsonElement("startTime")]
    [BsonIgnoreIfNull]
    public string? StartTime { get; set; }

    /// <summary>UTC end of the maintenance or operational window.</summary>
    [BsonElement("endTime")]
    [BsonIgnoreIfNull]
    public string? EndTime { get; set; }

    /// <summary>Reason for maintenance or operational block.</summary>
    [BsonElement("reason")]
    [BsonIgnoreIfNull]
    public string? Reason { get; set; }

    // Teammate's recurring operational schedule fields
    [BsonElement("dayOfWeek")]
    [BsonIgnoreIfNull]
    public string? DayOfWeek { get; set; }

    [BsonElement("openTime")]
    [BsonIgnoreIfNull]
    public string? OpenTime { get; set; }

    [BsonElement("closeTime")]
    [BsonIgnoreIfNull]
    public string? CloseTime { get; set; }

    [BsonElement("isClosed")]
    [BsonIgnoreIfNull]
    public bool? IsClosed { get; set; }
}

/// <summary>
/// Represents a physical Solar Microgrid Hub (station node).
/// Maps to the "SolarStationInfo" collection in MongoDB.
/// BSON elements are explicitly mapped to match the teammate's camelCase MongoDB document schema.
/// </summary>
[BsonIgnoreExtraElements]
public class SolarStationInfo
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Unique station code (e.g. "CMB-NORTH-01").
    /// Referenced by EnergyBookingSlot.StationId.
    /// </summary>
    [BsonElement("stationCode")]
    public string StationCode { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Total energy storage capacity in kilowatt-hours.</summary>
    [BsonElement("capacityKWh")]
    public double CapacityKWh { get; set; }

    /// <summary>Total number of physical battery docking slots at this hub.</summary>
    [BsonElement("totalBatterySlots")]
    public int TotalBatterySlots { get; set; }

    /// <summary>Currently available (unoccupied) battery slots. Overridable by operators.</summary>
    [BsonElement("availableBatterySlots")]
    public int AvailableBatterySlots { get; set; }

    /// <summary>
    /// Operational status of this station.
    /// Allowed values: "Active" | "Inactive" | "Maintenance"
    /// </summary>
    [BsonElement("status")]
    public string Status { get; set; } = "Active";

    /// <summary>Scheduled maintenance or operational hours for this station.</summary>
    [BsonElement("operationalSchedule")]
    public List<OperationalScheduleBlock> OperationalSchedule { get; set; } = new();
}
