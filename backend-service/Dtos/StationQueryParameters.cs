using System.ComponentModel.DataAnnotations;

namespace backend_service.Dtos;

/// <summary>Query string of <c>GET /api/stations</c> (backoffice management list).</summary>
public sealed class StationListQuery
{
    /// <summary>Filter by lifecycle state. Omit for all states.</summary>
    public string? Status { get; set; }

    /// <summary>Case-insensitive match against name or station code.</summary>
    public string? Search { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or greater.")]
    public int Page { get; set; } = 1;

    [Range(1, 100, ErrorMessage = "Page size must be between 1 and 100.")]
    public int PageSize { get; set; } = 20;

    /// <summary>
    /// Sort field. Validated against an allow-list in the service — a raw client
    /// string must never reach a sort expression.
    /// </summary>
    public string SortBy { get; set; } = "name";

    /// <summary>"asc" or "desc".</summary>
    public string SortDir { get; set; } = "asc";
}

/// <summary>Query string of <c>GET /api/stations/nearby</c>.</summary>
public sealed class NearbyStationQuery
{
    [Required(ErrorMessage = "Latitude is required.")]
    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90.")]
    public double? Latitude { get; set; }

    [Required(ErrorMessage = "Longitude is required.")]
    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180.")]
    public double? Longitude { get; set; }

    [Range(0.01, 100.0, ErrorMessage = "Radius must be greater than 0 and at most 100 km.")]
    public double RadiusKm { get; set; } = 10.0;

    [Range(1, 200, ErrorMessage = "Limit must be between 1 and 200.")]
    public int Limit { get; set; } = 50;
}
