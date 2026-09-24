/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Data transfer object for updating user profile details.
 * Last Modified: 2026-09-23
 */

using System.ComponentModel.DataAnnotations;

namespace backend_service.DTOs;

public class UpdateUserProfileRequestDto
{
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
    [StringLength(250, MinimumLength = 5)]
    public string Address { get; set; } = string.Empty;
}
