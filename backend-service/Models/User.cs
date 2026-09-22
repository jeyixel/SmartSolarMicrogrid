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

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string NormalizedEmail { get; set; } = string.Empty;

    public string NIC { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.String)]
    public UserRole Role { get; set; } = UserRole.Prosumer;

    [BsonRepresentation(BsonType.String)]
    public AccountStatus Status { get; set; } = AccountStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
