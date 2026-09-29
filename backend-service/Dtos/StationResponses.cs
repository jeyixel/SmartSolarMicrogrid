using System.ComponentModel.DataAnnotations;

namespace backend_service.Dtos;

/// <summary>Body of the deactivate request.</summary>
public sealed class DeactivateStationRequest
{
    [StringLength(250, ErrorMessage = "Reason must be 250 characters or fewer.")]
    public string? Reason { get; set; }
}

/// <summary>
/// Full station document, including audit fields. Backoffice and Grid Operator
/// only — never returned to a Prosumer.
/// </summary>
public sealed class StationResponse
{
    public string Id { get; set; } = string.Empty;
    public string StationCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? AddressLine { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double CapacityKWh { get; set; }
    public int TotalBatterySlots { get; set; }
    public int AvailableBatterySlots { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<ScheduleEntryDto> OperationalSchedule { get; set; } = new();
    public string? ContactPhone { get; set; }
    public bool IsOpenNow { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public DateTime? UpdatedAtUtc { get; set; }
    public string? UpdatedByUserId { get; set; }
    public DateTime? DeactivatedAtUtc { get; set; }
    public string? DeactivationReason { get; set; }
}

/// <summary>One row of the backoffice management list.</summary>
public sealed class StationSummaryResponse
{
    public string Id { get; set; } = string.Empty;
    public string StationCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double CapacityKWh { get; set; }
    public int TotalBatterySlots { get; set; }
    public int AvailableBatterySlots { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

/// <summary>A page of results plus the counts the web client needs to render paging.</summary>
public sealed class PagedResponse<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public long TotalCount { get; set; }
    public int TotalPages { get; set; }
}

/// <summary>
/// One map marker. Deliberately small: this is fetched every time the map loads,
/// so the description, address, schedule and audit fields are left out and
/// arrive only on marker selection.
/// </summary>
public sealed class StationMapSummaryResponse
{
    public string Id { get; set; } = string.Empty;
    public string StationCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double CapacityKWh { get; set; }
    public int AvailableBatterySlots { get; set; }

    /// <summary>Great-circle distance from the query point, kilometres, 2 decimals.</summary>
    public double DistanceKm { get; set; }

    /// <summary>Computed server-side so the phone does not have to parse time windows.</summary>
    public bool IsOpenNow { get; set; }
}

/// <summary>
/// What the Android app shows after a marker tap. No audit fields and no
/// internal identifiers: this is the public face of a station.
/// </summary>
public sealed class StationDetailResponse
{
    public string Id { get; set; } = string.Empty;
    public string StationCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? AddressLine { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double CapacityKWh { get; set; }
    public int TotalBatterySlots { get; set; }
    public int AvailableBatterySlots { get; set; }
    public List<ScheduleEntryDto> OperationalSchedule { get; set; } = new();
    public bool IsOpenNow { get; set; }
    public string? ContactPhone { get; set; }
}

/// <summary>Minimal station identity, for dropdowns in Member 3 and Member 4's screens.</summary>
public sealed class StationLookupResponse
{
    public string Id { get; set; } = string.Empty;
    public string StationCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Answer to "may this station be deactivated right now?", so the web UI can
/// warn before the operator clicks rather than failing at the moment of action.
/// </summary>
public sealed class DeactivationEligibilityResponse
{
    public string StationId { get; set; } = string.Empty;
    public bool CanDeactivate { get; set; }
    public int ActiveReservationCount { get; set; }

    /// <summary>Why not, when <see cref="CanDeactivate"/> is false.</summary>
    public string? Reason { get; set; }
}
