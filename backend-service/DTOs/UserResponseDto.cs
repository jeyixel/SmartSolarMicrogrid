/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Safe data transfer object representing user details without sensitive fields.
 * Last Modified: 2026-09-23
 */

using backend_service.Models;

namespace backend_service.DTOs;

public class UserResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Nic { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public AccountStatus AccountStatus { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeactivationRequestedAt { get; set; }
    public DateTime? DeactivatedAt { get; set; }
    public string? DeactivatedBy { get; set; }
    public DateTime? ReactivatedAt { get; set; }
    public string? ReactivatedBy { get; set; }

    public static UserResponseDto FromUser(User user)
    {
        return new UserResponseDto
        {
            Id = user.Id,
            Nic = user.NIC,
            FullName = user.FullName,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            Address = user.Address,
            Role = user.Role,
            AccountStatus = user.Status,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            DeactivationRequestedAt = user.DeactivationRequestedAt,
            DeactivatedAt = user.DeactivatedAt,
            DeactivatedBy = user.DeactivatedBy,
            ReactivatedAt = user.ReactivatedAt,
            ReactivatedBy = user.ReactivatedBy
        };
    }
}
