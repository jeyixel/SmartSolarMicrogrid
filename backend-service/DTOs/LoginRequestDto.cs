/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Data transfer object for user authentication requests.
 * Last Modified: 2026-09-22
 */

using System.ComponentModel.DataAnnotations;

namespace backend_service.DTOs;

public class LoginRequestDto
{
    [Required(AllowEmptyStrings = false, ErrorMessage = "Email or NIC is required.")]
    public string Identifier { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;
}
