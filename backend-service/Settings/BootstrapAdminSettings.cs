/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Configuration settings model for development bootstrap administrator seeding.
 * Last Modified: 2026-09-22
 */

namespace backend_service.Settings;

public class BootstrapAdminSettings
{
    public bool Enabled { get; set; } = false;
    public string Email { get; set; } = string.Empty;
    public string NIC { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
