using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

/// <summary>
/// Represents a maintenance or operational blackout window at a microgrid station.
/// Stored as an embedded array within SolarStationInfo.OperationalSchedule.
/// </summary>
public class OperationalScheduleBlock
{
    /// <summary>UTC start of the maintenance or operational window.</summary>
    public DateTime StartTime { get; set; }

    /// <summary>UTC end of the maintenance or operational window.</summary>
    public DateTime EndTime { get; set; }

    /// <summary>Human-readable reason for the block (e.g. "Scheduled battery calibration").</summary>
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// Represents a physical Solar Microgrid Hub (station node).
/// This collection is managed by the Station Management module (separate team member).
/// Member 3 reads station data for reservation validation and exposes a lightweight
/// management API (slot override + schedule blocks) within the Reservation domain.
/// EnergyBookingSlot.StationId references SolarStationInfo.StationCode.
/// </summary>
public class SolarStationInfo
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Unique human-readable station code (e.g. "CMB-NORTH-01").
    /// Referenced by EnergyBookingSlot.StationId.
    /// </summary>
    public string StationCode { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>Total energy storage capacity in kilowatt-hours.</summary>
    public double CapacityKWh { get; set; }

    /// <summary>Total number of physical battery docking slots at this hub.</summary>
    public int TotalBatterySlots { get; set; }

    /// <summary>Currently available (unoccupied) battery slots. Overridable by operators.</summary>
    public int AvailableBatterySlots { get; set; }

    /// <summary>
    /// Operational status of this station.
    /// Allowed values: "Active" | "Inactive" | "Maintenance"
    /// </summary>
    public string Status { get; set; } = "Active";

    /// <summary>Scheduled maintenance and operational blackout windows for this station.</summary>
    public List<OperationalScheduleBlock> OperationalSchedule { get; set; } = new();
}
