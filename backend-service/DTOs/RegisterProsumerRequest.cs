/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Data transfer object for prosumer registration requests.
 * Last Modified: 2026-09-23
 */

using System.ComponentModel.DataAnnotations;

namespace backend_service.DTOs;

public class RegisterProsumerRequest
{
    [Required(AllowEmptyStrings = false, ErrorMessage = "NIC is required.")]
    [RegularExpression(@"^(?:[0-9]{12}|[0-9]{9}[VvXx])$", ErrorMessage = "NIC must contain either 12 digits or 9 digits followed by V or X.")]
    public string Nic { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Full name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 100 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    public string Email { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Phone number is required.")]
    [RegularExpression(@"^0[0-9]{9}$", ErrorMessage = "Phone number must contain 10 digits and begin with 0.")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Address is required.")]
    [StringLength(250, MinimumLength = 5, ErrorMessage = "Address must be between 5 and 250 characters.")]
    public string Address { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;
}
