using backend_service.Models;

namespace backend_service.Services;

/// <summary>
/// Decides whether a station is open at a given moment, so the Android client
/// never has to parse time windows or reason about time zones.
/// </summary>
/// <remarks>
/// Schedule times are station-local. This project deploys to a single region, so
/// "local" is resolved through one configured time zone
/// (<c>Stations:TimeZoneId</c>, default <c>Sri Lanka Standard Time</c>) rather
/// than being stored per station. A multi-region deployment would need a time
/// zone field on the station document.
/// </remarks>
public sealed class ScheduleEvaluator : IScheduleEvaluator
{
    private readonly TimeZoneInfo _stationTimeZone;
    private readonly ILogger<ScheduleEvaluator> _logger;

    public ScheduleEvaluator(IConfiguration configuration, ILogger<ScheduleEvaluator> logger)
    {
        _logger = logger;

        var timeZoneId = configuration["Stations:TimeZoneId"] ?? "Sri Lanka Standard Time";
        _stationTimeZone = ResolveTimeZone(timeZoneId, logger);
    }

    /// <summary>
    /// True when the current station-local time falls inside a window for today.
    /// A station with no schedule is treated as always open — an operator who has
    /// not entered hours has not declared the station shut.
    /// </summary>
    public bool IsOpenNow(IReadOnlyCollection<OperationalScheduleEntry>? schedule)
        => IsOpenAt(schedule, DateTime.UtcNow);

    /// <summary>Testable form of <see cref="IsOpenNow"/>.</summary>
    public bool IsOpenAt(IReadOnlyCollection<OperationalScheduleEntry>? schedule, DateTime utcInstant)
    {
        if (schedule is null || schedule.Count == 0)
        {
            return true;
        }

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.SpecifyKind(utcInstant, DateTimeKind.Utc), _stationTimeZone);

        var today = schedule.FirstOrDefault(e => e.DayOfWeek == localNow.DayOfWeek);
        if (today is null || today.IsClosed)
        {
            return false;
        }

        if (!TryParseTime(today.OpenTime, out var open) || !TryParseTime(today.CloseTime, out var close))
        {
            // Stored data that cannot be parsed should not crash a map load.
            _logger.LogWarning(
                "Unparseable schedule window {Open}-{Close} for {Day}; treating the station as closed.",
                today.OpenTime, today.CloseTime, today.DayOfWeek);
            return false;
        }

        var nowTime = localNow.TimeOfDay;

        // A window whose close is at or before its open is rejected at write
        // time, so this compares a single same-day interval.
        return nowTime >= open && nowTime < close;
    }

    /// <summary>Parses an "HH:mm" window boundary.</summary>
    public static bool TryParseTime(string? value, out TimeSpan time)
    {
        time = default;

        return !string.IsNullOrWhiteSpace(value)
               && TimeSpan.TryParseExact(value.Trim(), @"hh\:mm",
                   System.Globalization.CultureInfo.InvariantCulture, out time);
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId, ILogger logger)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            logger.LogError(ex,
                "Station time zone '{TimeZoneId}' was not found. Falling back to UTC; " +
                "open/closed status will be wrong until this is configured correctly.",
                timeZoneId);

            return TimeZoneInfo.Utc;
        }
    }
}

/// <summary>Abstraction so the open/closed rule can be stubbed in tests.</summary>
public interface IScheduleEvaluator
{
    bool IsOpenNow(IReadOnlyCollection<OperationalScheduleEntry>? schedule);

    bool IsOpenAt(IReadOnlyCollection<OperationalScheduleEntry>? schedule, DateTime utcInstant);
}
