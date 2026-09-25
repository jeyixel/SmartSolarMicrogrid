/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Response DTO containing signed JWT token, expiration timestamp, and user summary.
 * Last Modified: 2026-09-22
 */

namespace backend_service.DTOs;

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public AuthenticatedUserDto User { get; set; } = new();
}
