using backend_service.Dtos;
using backend_service.Models;

namespace backend_service.Services;

/// <summary>
/// Entity to DTO projections. Kept in one place so a field added to the entity
/// cannot leak into a public response by accident — each projection lists the
/// fields it exposes explicitly.
/// </summary>
public static class StationMapper
{
    public static StationResponse ToFullResponse(SolarStationInfo station, bool isOpenNow) => new()
    {
        Id = station.Id ?? string.Empty,
        StationCode = station.StationCode,
        Name = station.Name,
        Description = station.Description,
        AddressLine = station.AddressLine,
        Latitude = station.Latitude,
        Longitude = station.Longitude,
        CapacityKWh = station.CapacityKWh,
        TotalBatterySlots = station.TotalBatterySlots,
        AvailableBatterySlots = station.AvailableBatterySlots,
        Status = station.Status.ToString(),
        OperationalSchedule = ToScheduleDtos(station.OperationalSchedule),
        ContactPhone = station.ContactPhone,
        IsOpenNow = isOpenNow,
        CreatedAtUtc = station.CreatedAtUtc,
        CreatedByUserId = station.CreatedByUserId,
        UpdatedAtUtc = station.UpdatedAtUtc,
        UpdatedByUserId = station.UpdatedByUserId,
        DeactivatedAtUtc = station.DeactivatedAtUtc,
        DeactivationReason = station.DeactivationReason
    };

    public static StationSummaryResponse ToSummary(SolarStationInfo station) => new()
    {
        Id = station.Id ?? string.Empty,
        StationCode = station.StationCode,
        Name = station.Name,
        Latitude = station.Latitude,
        Longitude = station.Longitude,
        CapacityKWh = station.CapacityKWh,
        TotalBatterySlots = station.TotalBatterySlots,
        AvailableBatterySlots = station.AvailableBatterySlots,
        Status = station.Status.ToString(),
        CreatedAtUtc = station.CreatedAtUtc,
        UpdatedAtUtc = station.UpdatedAtUtc
    };

    /// <summary>Map marker. No audit fields — this goes to every authenticated caller.</summary>
    public static StationMapSummaryResponse ToMapSummary(SolarStationInfo station, double distanceKm, bool isOpenNow) => new()
    {
        Id = station.Id ?? string.Empty,
        StationCode = station.StationCode,
        Name = station.Name,
        Latitude = station.Latitude,
        Longitude = station.Longitude,
        CapacityKWh = station.CapacityKWh,
        AvailableBatterySlots = station.AvailableBatterySlots,
        DistanceKm = Math.Round(distanceKm, 2),
        IsOpenNow = isOpenNow
    };

    /// <summary>Public detail after a marker tap. No audit fields.</summary>
    public static StationDetailResponse ToPublicDetail(SolarStationInfo station, bool isOpenNow) => new()
    {
        Id = station.Id ?? string.Empty,
        StationCode = station.StationCode,
        Name = station.Name,
        Description = station.Description,
        AddressLine = station.AddressLine,
        Latitude = station.Latitude,
        Longitude = station.Longitude,
        CapacityKWh = station.CapacityKWh,
        TotalBatterySlots = station.TotalBatterySlots,
        AvailableBatterySlots = station.AvailableBatterySlots,
        OperationalSchedule = ToScheduleDtos(station.OperationalSchedule),
        IsOpenNow = isOpenNow,
        ContactPhone = station.ContactPhone
    };

    public static StationLookupResponse ToLookup(SolarStationInfo station) => new()
    {
        Id = station.Id ?? string.Empty,
        StationCode = station.StationCode,
        Name = station.Name
    };

    public static List<ScheduleEntryDto> ToScheduleDtos(IEnumerable<OperationalScheduleEntry>? schedule) =>
        schedule?.Select(e => new ScheduleEntryDto
        {
            DayOfWeek = e.DayOfWeek.ToString(),
            OpenTime = e.OpenTime,
            CloseTime = e.CloseTime,
            IsClosed = e.IsClosed
        }).ToList() ?? new List<ScheduleEntryDto>();

    /// <summary>
    /// Converts request schedule entries to entity form. Assumes the day names
    /// have already been validated.
    /// </summary>
    public static List<OperationalScheduleEntry> ToScheduleEntities(IEnumerable<ScheduleEntryDto>? schedule) =>
        schedule?.Select(e => new OperationalScheduleEntry
        {
            DayOfWeek = Enum.Parse<DayOfWeek>(e.DayOfWeek, ignoreCase: true),
            OpenTime = e.OpenTime.Trim(),
            CloseTime = e.CloseTime.Trim(),
            IsClosed = e.IsClosed
        }).ToList() ?? new List<OperationalScheduleEntry>();
}
