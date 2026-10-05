/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Represents a user entity stored in MongoDB.
 * Last Modified: 2026-09-22
 */

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend_service.Models;

[BsonIgnoreExtraElements]
public class User
{
    [BsonId]
    public string Id { get; set; } = string.Empty;

    [BsonElement("fullName")]
    public string FullName { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("normalizedEmail")]
    public string NormalizedEmail { get; set; } = string.Empty;

    [BsonElement("phoneNumber")]
    public string PhoneNumber { get; set; } = string.Empty;

    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;

    [BsonElement("nic")]
    public string NIC { get; set; } = string.Empty;

    [BsonElement("passwordHash")]
    public string PasswordHash { get; set; } = string.Empty;

    [BsonElement("role")]
    [BsonRepresentation(BsonType.String)]
    public UserRole Role { get; set; } = UserRole.Prosumer;

    [BsonElement("accountStatus")]
    [BsonRepresentation(BsonType.String)]
    public AccountStatus Status { get; set; } = AccountStatus.Pending;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime? UpdatedAt { get; set; }

    [BsonElement("activatedAt")]
    public DateTime? ActivatedAt { get; set; }

    [BsonElement("activatedBy")]
    public string? ActivatedBy { get; set; }

    [BsonElement("deactivationRequestedAt")]
    public DateTime? DeactivationRequestedAt { get; set; }

    [BsonElement("deactivatedAt")]
    public DateTime? DeactivatedAt { get; set; }

    [BsonElement("deactivatedBy")]
    public string? DeactivatedBy { get; set; }

    [BsonElement("reactivatedAt")]
    public DateTime? ReactivatedAt { get; set; }

    [BsonElement("reactivatedBy")]
    public string? ReactivatedBy { get; set; }
}
