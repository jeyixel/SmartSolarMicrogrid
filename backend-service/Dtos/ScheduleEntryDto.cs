using System.ComponentModel.DataAnnotations;

namespace backend_service.Dtos;

/// <summary>One weekly opening window, as sent and returned over the API.</summary>
public sealed class ScheduleEntryDto
{
    /// <summary>Day name: Monday … Sunday.</summary>
    [Required(ErrorMessage = "Day of week is required.")]
    public string DayOfWeek { get; set; } = string.Empty;

    /// <summary>Window start, 24-hour "HH:mm".</summary>
    [Required(ErrorMessage = "Open time is required.")]
    [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "Open time must be in HH:mm 24-hour format.")]
    public string OpenTime { get; set; } = string.Empty;

    /// <summary>Window end, 24-hour "HH:mm".</summary>
    [Required(ErrorMessage = "Close time is required.")]
    [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "Close time must be in HH:mm 24-hour format.")]
    public string CloseTime { get; set; } = string.Empty;

    /// <summary>When true the station is shut all day and the times are ignored.</summary>
    public bool IsClosed { get; set; }
}
