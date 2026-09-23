using backend_service.Data;
using backend_service.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend_service.Controllers;

/// <summary>
/// Lightweight management API for the SolarStationInfo collection.
/// Primary ownership of this collection belongs to the Station Management module (separate team member).
/// This controller exposes:
///   GET    /api/stations                               → List all stations (falls back to mock data)
///   GET    /api/stations/{stationCode}                 → Single station lookup
///   PATCH  /api/stations/{stationCode}/slots           → Override availableBatterySlots
///   POST   /api/stations/{stationCode}/schedule        → Add a maintenance/operational block
///   DELETE /api/stations/{stationCode}/schedule/{idx}  → Remove a schedule block by index
///
/// [AllowAnonymous] applied temporarily while the User Identity module is pending.
/// </summary>
[ApiController]
[Route("api/stations")]
[AllowAnonymous]
public class SolarStationController : ControllerBase
{
    private readonly ISolarStationRepository _stationRepo;

    /// <summary>
    /// Hardcoded mock stations used as fallback when the SolarStationInfo collection is empty.
    /// These match the reference document provided in the task spec.
    /// Once the Station Management module is deployed and populates the collection,
    /// these mocks will be bypassed automatically.
    /// </summary>
    private static readonly List<SolarStationInfo> MockStations = new()
    {
        new SolarStationInfo
        {
            StationCode = "CMB-NORTH-01",
            Name = "Colombo North Solar Hub",
            CapacityKWh = 250.5,
            TotalBatterySlots = 20,
            AvailableBatterySlots = 3,
            Status = "Active",
            OperationalSchedule = new List<OperationalScheduleBlock>()
        },
        new SolarStationInfo
        {
            StationCode = "CMB-SOUTH-01",
            Name = "Colombo South Solar Hub",
            CapacityKWh = 180.0,
            TotalBatterySlots = 15,
            AvailableBatterySlots = 8,
            Status = "Active",
            OperationalSchedule = new List<OperationalScheduleBlock>()
        },
        new SolarStationInfo
        {
            StationCode = "KND-EAST-01",
            Name = "Kandy East Microgrid",
            CapacityKWh = 120.0,
            TotalBatterySlots = 10,
            AvailableBatterySlots = 10,
            Status = "Active",
            OperationalSchedule = new List<OperationalScheduleBlock>()
        },
        new SolarStationInfo
        {
            StationCode = "GLO-WEST-01",
            Name = "Galle West Energy Hub",
            CapacityKWh = 95.0,
            TotalBatterySlots = 8,
            AvailableBatterySlots = 2,
            Status = "Active",
            OperationalSchedule = new List<OperationalScheduleBlock>()
        }
    };

    public SolarStationController(ISolarStationRepository stationRepo)
    {
        _stationRepo = stationRepo;
    }

    /// <summary>
    /// Returns all microgrid stations.
    /// Falls back to hardcoded mock data if the SolarStationInfo collection is empty
    /// (supports development while the Station Management module is pending).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<SolarStationInfo>>> GetAll()
    {
        var stations = await _stationRepo.GetAllAsync();
        return Ok(stations.Any() ? stations : MockStations);
    }

    /// <summary>Returns a single station by its station code (e.g. "CMB-NORTH-01").</summary>
    [HttpGet("{stationCode}")]
    public async Task<ActionResult<SolarStationInfo>> Get(string stationCode)
    {
        var station = await _stationRepo.GetByStationCodeAsync(stationCode);
        if (station != null) return Ok(station);

        var mock = MockStations.FirstOrDefault(s => s.StationCode == stationCode);
        if (mock == null) return NotFound(new { error = $"Station '{stationCode}' not found." });
        return Ok(mock);
    }

    /// <summary>
    /// Overrides the available battery slot count for a station.
    /// If the station exists only in mock data, it is promoted to the database on first write.
    /// </summary>
    [HttpPatch("{stationCode}/slots")]
    public async Task<ActionResult<SolarStationInfo>> UpdateAvailableSlots(
        string stationCode,
        [FromBody] UpdateSlotsRequest request,
        [FromHeader(Name = "X-User-Id")] string? userId = null)
    {
        var station = await _stationRepo.GetByStationCodeAsync(stationCode);

        if (station == null)
        {
            // Promote mock station to MongoDB on first write
            var mock = MockStations.FirstOrDefault(s => s.StationCode == stationCode);
            if (mock == null) return NotFound(new { error = $"Station '{stationCode}' not found." });

            if (request.AvailableBatterySlots < 0 || request.AvailableBatterySlots > mock.TotalBatterySlots)
                return BadRequest(new
                {
                    error = $"Available slots must be between 0 and {mock.TotalBatterySlots} (total capacity)."
                });

            mock.AvailableBatterySlots = request.AvailableBatterySlots;
            await _stationRepo.CreateAsync(mock);
            return Ok(mock);
        }

        if (request.AvailableBatterySlots < 0 || request.AvailableBatterySlots > station.TotalBatterySlots)
            return BadRequest(new
            {
                error = $"Available slots must be between 0 and {station.TotalBatterySlots} (total capacity)."
            });

        station.AvailableBatterySlots = request.AvailableBatterySlots;
        await _stationRepo.UpdateAsync(stationCode, station);
        return Ok(station);
    }

    /// <summary>
    /// Adds a maintenance or operational blackout block to a station's schedule.
    /// If the station exists only in mock data, it is promoted to the database on first write.
    /// </summary>
    [HttpPost("{stationCode}/schedule")]
    public async Task<ActionResult<SolarStationInfo>> AddScheduleBlock(
        string stationCode,
        [FromBody] OperationalScheduleBlock block,
        [FromHeader(Name = "X-User-Id")] string? userId = null)
    {
        if (block.EndTime <= block.StartTime)
            return BadRequest(new { error = "Schedule block EndTime must be after StartTime." });

        var station = await _stationRepo.GetByStationCodeAsync(stationCode);

        if (station == null)
        {
            var mock = MockStations.FirstOrDefault(s => s.StationCode == stationCode);
            if (mock == null) return NotFound(new { error = $"Station '{stationCode}' not found." });

            mock.OperationalSchedule.Add(block);
            await _stationRepo.CreateAsync(mock);
            return Ok(mock);
        }

        station.OperationalSchedule.Add(block);
        await _stationRepo.UpdateAsync(stationCode, station);
        return Ok(station);
    }

    /// <summary>
    /// Removes a maintenance block from a station's schedule by its zero-based index.
    /// Note: Only works for stations stored in the database (not mock-only stations).
    /// </summary>
    [HttpDelete("{stationCode}/schedule/{index:int}")]
    public async Task<ActionResult<SolarStationInfo>> RemoveScheduleBlock(string stationCode, int index)
    {
        var station = await _stationRepo.GetByStationCodeAsync(stationCode);
        if (station == null)
            return NotFound(new
            {
                error = $"Station '{stationCode}' not found in the database. " +
                        "Please write to the station first (add a schedule block or override slots) to persist it."
            });

        if (index < 0 || index >= station.OperationalSchedule.Count)
            return BadRequest(new { error = $"Invalid schedule block index {index}. Valid range: 0–{station.OperationalSchedule.Count - 1}." });

        station.OperationalSchedule.RemoveAt(index);
        await _stationRepo.UpdateAsync(stationCode, station);
        return Ok(station);
    }
}

/// <summary>Request body for PATCH /api/stations/{stationCode}/slots</summary>
public record UpdateSlotsRequest(int AvailableBatterySlots);
