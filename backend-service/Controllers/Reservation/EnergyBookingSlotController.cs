using backend_service.Models;
using backend_service.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend_service.Controllers;

/// <summary>
/// Manages the physical EnergyBookingSlots collection.
/// Slots represent time windows at a microgrid station (StationId FK → SolarStationInfo).
/// Business rule enforcement (7-Day, 12-Hour) lives in EnergyReservationController.
/// 
/// [AllowAnonymous] applied temporarily while the User Identity module is pending.
/// Replace with [Authorize] once auth is wired up.
/// </summary>
[ApiController]
[Route("api/slots")]
[AllowAnonymous]
public class EnergyBookingSlotController : ControllerBase
{
    private readonly IEnergyBookingSlotService _slotService;

    public EnergyBookingSlotController(IEnergyBookingSlotService slotService)
    {
        _slotService = slotService;
    }

    /// <summary>Returns all energy booking slots across all stations.</summary>
    [HttpGet]
    public async Task<ActionResult<List<EnergyBookingSlot>>> GetAll()
    {
        var slots = await _slotService.GetAllSlotsAsync();
        return Ok(slots);
    }

    /// <summary>Returns all slots for a specific microgrid station.</summary>
    [HttpGet("by-station/{stationId}")]
    public async Task<ActionResult<List<EnergyBookingSlot>>> GetByStation(string stationId)
    {
        var slots = await _slotService.GetSlotsByStationAsync(stationId);
        return Ok(slots);
    }

    /// <summary>Returns a single energy booking slot by its MongoDB ObjectId.</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<EnergyBookingSlot>> Get(string id)
    {
        var slot = await _slotService.GetSlotByIdAsync(id);
        if (slot == null)
            return NotFound(new { error = $"Booking slot '{id}' not found." });
        return Ok(slot);
    }

    /// <summary>
    /// Creates a new physical booking slot at a microgrid station.
    /// Pass X-User-Id header to populate audit trail fields.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<EnergyBookingSlot>> Create(
        [FromBody] EnergyBookingSlot slot,
        [FromHeader(Name = "X-User-Id")] string? userId = null)
    {
        try
        {
            var created = await _slotService.CreateSlotAsync(slot, userId ?? "anonymous");
            return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Updates an existing booking slot (e.g. change status to Maintenance).
    /// Pass X-User-Id header to populate audit trail fields.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(
        string id,
        [FromBody] EnergyBookingSlot slot,
        [FromHeader(Name = "X-User-Id")] string? userId = null)
    {
        try
        {
            await _slotService.UpdateSlotAsync(id, slot, userId ?? "anonymous");
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Permanently removes a booking slot (use with caution — linked reservations are not auto-cancelled).</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        try
        {
            await _slotService.DeleteSlotAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
