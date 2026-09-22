/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Configuration settings model for JSON Web Tokens (JWT).
 * Last Modified: 2026-09-22
 */

namespace backend_service.Settings;

public class JwtSettings
{
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public int ExpiryMinutes { get; set; } = 60;
}
