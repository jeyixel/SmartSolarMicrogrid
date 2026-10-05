/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Data transfer object representing the response returned after prosumer registration.
 * Last Modified: 2026-09-23
 */

namespace backend_service.DTOs;

public class RegisterProsumerResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string AccountStatus { get; set; } = "Pending";
}
