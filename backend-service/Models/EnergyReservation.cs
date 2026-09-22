using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

public class EnergyReservation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.ObjectId)]
    public string SlotId { get; set; } = string.Empty;

    public string ProsumerId { get; set; } = string.Empty;

    public string Status { get; set; } = "Active"; // Active, Cancelled, Completed

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

