using System.ComponentModel.DataAnnotations;

namespace backend_service.Dtos;

/// <summary>
/// Body of <c>POST /api/stations</c>. Audit fields are deliberately absent:
/// they are server-set, and anything a client sends for them is discarded.
/// </summary>
public sealed class CreateStationRequest
{
    [Required(ErrorMessage = "Station code is required.")]
    [StringLength(20, MinimumLength = 3, ErrorMessage = "Station code must be between 3 and 20 characters.")]
    [RegularExpression("^[A-Za-z0-9-]+$", ErrorMessage = "Station code may contain only letters, digits and hyphens.")]
    public string StationCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "Name is required.")]
    [StringLength(100, MinimumLength = 3, ErrorMessage = "Name must be between 3 and 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Description must be 500 characters or fewer.")]
    public string? Description { get; set; }

    [StringLength(200, ErrorMessage = "Address must be 200 characters or fewer.")]
    public string? AddressLine { get; set; }

    [Required(ErrorMessage = "Latitude is required.")]
    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90.")]
    public double? Latitude { get; set; }

    [Required(ErrorMessage = "Longitude is required.")]
    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180.")]
    public double? Longitude { get; set; }

    [Required(ErrorMessage = "Capacity is required.")]
    [Range(0.01, 100000.0, ErrorMessage = "Capacity must be greater than 0 and at most 100000 kWh.")]
    public double? CapacityKWh { get; set; }

    [Required(ErrorMessage = "Total battery slots is required.")]
    [Range(1, 1000, ErrorMessage = "Total battery slots must be between 1 and 1000.")]
    public int? TotalBatterySlots { get; set; }

    [Required(ErrorMessage = "Available battery slots is required.")]
    [Range(0, 1000, ErrorMessage = "Available battery slots must be 0 or greater.")]
    public int? AvailableBatterySlots { get; set; }

    /// <summary>Optional; only <c>Active</c> or <c>Inactive</c>. Defaults to <c>Active</c>.</summary>
    public string? Status { get; set; }

    public List<ScheduleEntryDto>? OperationalSchedule { get; set; }

    [StringLength(20, ErrorMessage = "Contact phone must be 20 characters or fewer.")]
    [RegularExpression(@"^[0-9+\-\s]+$", ErrorMessage = "Contact phone may contain only digits, spaces, '+' and '-'.")]
    public string? ContactPhone { get; set; }
}
