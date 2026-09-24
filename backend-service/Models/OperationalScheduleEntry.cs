using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

/// <summary>
/// One weekly opening window for a station. Embedded in the station document:
/// the collection is small (at most seven entries), is never queried on its own,
/// and is always read together with its station.
/// </summary>
public sealed class OperationalScheduleEntry
{
    [BsonElement("dayOfWeek")]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public DayOfWeek DayOfWeek { get; set; }

    /// <summary>Window start in 24-hour "HH:mm" form, station-local time.</summary>
    [BsonElement("openTime")]
    public string OpenTime { get; set; } = string.Empty;

    /// <summary>Window end in 24-hour "HH:mm" form, station-local time.</summary>
    [BsonElement("closeTime")]
    public string CloseTime { get; set; } = string.Empty;

    /// <summary>When true the station is shut for the whole day and the times are ignored.</summary>
    [BsonElement("isClosed")]
    public bool IsClosed { get; set; }
}
