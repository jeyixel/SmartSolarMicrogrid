/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Data transfer object for creating staff accounts (Backoffice / GridOperator).
 * Last Modified: 2026-09-23
 */

using System.ComponentModel.DataAnnotations;

namespace backend_service.DTOs;

public class CreateStaffUserRequestDto
{
    [Required]
    [RegularExpression(@"^(?:[0-9]{12}|[0-9]{9}[VvXx])$")]
    public string Nic { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [RegularExpression(@"^0[0-9]{9}$")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Backoffice|GridOperator)$",
        ErrorMessage = "Role must be Backoffice or GridOperator.")]
    public string Role { get; set; } = string.Empty;
}
