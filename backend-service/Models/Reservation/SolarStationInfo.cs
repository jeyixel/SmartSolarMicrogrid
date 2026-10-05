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

