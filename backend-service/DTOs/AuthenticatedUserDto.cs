/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Safe data transfer object representing authenticated user summary without sensitive fields.
 * Last Modified: 2026-09-22
 */

namespace backend_service.DTOs;

public class AuthenticatedUserDto
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string NIC { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}
