using backend_service.DTOs;
using backend_service.Models;
using backend_service.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend_service.Controllers;

/// <summary>
/// FAT controller for the EnergyReservations collection.
/// All business logic is delegated to EnergyReservationService:
///
///   POST  /api/reservations        → 7-Day Scheduling Rule
///   PUT   /api/reservations/{id}   → 12-Hour Modification Rule
///   DELETE /api/reservations/{id}  → 12-Hour Cancellation Rule
///
/// On rule violations, returns HTTP 400 with a structured JSON body:
///   { "error": "Human-readable message", "rule": "7DayRule|12HourRule|ValidationError" }
///
/// [AllowAnonymous] applied temporarily while the User Identity module is pending.
/// Replace with [Authorize] once auth is wired up.
/// </summary>
[ApiController]
[Route("api/reservations")]
[AllowAnonymous]
public class EnergyReservationController : ControllerBase
{
    private readonly IEnergyReservationService _reservationService;

    public EnergyReservationController(IEnergyReservationService reservationService)
    {
        _reservationService = reservationService;
    }

    /// <summary>Returns all reservations system-wide. Used by Backoffice admins.</summary>
    [HttpGet]
    public async Task<ActionResult<List<EnergyReservation>>> GetAll()
    {
        var reservations = await _reservationService.GetAllReservationsAsync();
        return Ok(reservations);
    }

    /// <summary>Returns a specific reservation by its MongoDB ObjectId.</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<EnergyReservation>> Get(string id)
    {
        var reservation = await _reservationService.GetReservationByIdAsync(id);
        if (reservation == null)
            return NotFound(new { error = $"Reservation '{id}' not found." });
        return Ok(reservation);
    }

    /// <summary>
    /// Creates a new prosumer reservation linked to an EnergyBookingSlot.
    /// Enforces the 7-Day Scheduling Rule via EnergyReservationService.
    /// Returns 400 with { "error": "...", "rule": "7DayRule" } on violation.
    /// Pass X-User-Id header to populate audit trail fields.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<EnergyReservation>> Create(
        [FromBody] EnergyReservation reservation,
        [FromHeader(Name = "X-User-Id")] string? userId = null)
    {
        reservation.CreatedByUserId = userId ?? "anonymous";
        reservation.UpdatedByUserId = userId ?? "anonymous";

        try
        {
            var created = await _reservationService.CreateReservationAsync(reservation);
            return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message, rule = "ValidationError" });
        }
        catch (InvalidOperationException ex)
        {
            // Identify which rule was violated by the message content
            var rule = ex.Message.Contains("7") || ex.Message.Contains("7 days") ? "7DayRule" : "BusinessRule";
            return BadRequest(new { error = ex.Message, rule });
        }
    }

    /// <summary>
    /// Updates an existing reservation's prosumer details.
    /// Enforces the 12-Hour Modification Rule via EnergyReservationService.
    /// Returns 400 with { "error": "...", "rule": "12HourRule" } on violation.
    /// Pass X-User-Id header to populate audit trail fields.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(
        string id,
        [FromBody] EnergyReservation reservation,
        [FromHeader(Name = "X-User-Id")] string? userId = null)
    {
        try
        {
            await _reservationService.UpdateReservationAsync(id, reservation, userId ?? "anonymous");
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message, rule = "ValidationError" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message, rule = "12HourRule" });
        }
    }

    /// <summary>
    /// Cancels a reservation and releases its linked EnergyBookingSlot back to "Available".
    /// Enforces the 12-Hour Cancellation Rule via EnergyReservationService.
    /// Returns 400 with { "error": "...", "rule": "12HourRule" } on violation.
    /// Pass X-User-Id header to populate audit trail fields.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(
        string id,
        [FromHeader(Name = "X-User-Id")] string? userId = null)
    {
        try
        {
            await _reservationService.CancelReservationAsync(id, userId ?? "anonymous");
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message, rule = "ValidationError" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message, rule = "12HourRule" });
        }
    }

    /// <summary>
    /// Returns live dashboard statistics (pending count, upcoming approved count, total bookings) for a prosumer by NIC.
    /// </summary>
    [HttpGet("dashboard/{nic}")]
    public async Task<ActionResult<DashboardStatsDto>> GetDashboardStats(string nic)
    {
        // Validate incoming prosumer NIC parameter
        if (string.IsNullOrWhiteSpace(nic))
        {
            return BadRequest(new { error = "Prosumer NIC parameter cannot be null or empty." });
        }

        // Delegate statistics aggregation to the reservation service
        var stats = await _reservationService.GetDashboardStatsAsync(nic);
        return Ok(stats);
    }

    /// <summary>
    /// Retrieves prosumer booking history with optional filtering by status, date range, and search text.
    /// </summary>
    [HttpGet("history/{nic}")]
    public async Task<ActionResult<List<ReservationHistoryDto>>> GetBookingHistory(
        string nic,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? search = null)
    {
        // Validate incoming prosumer NIC parameter
        if (string.IsNullOrWhiteSpace(nic))
        {
            return BadRequest(new { error = "Prosumer NIC parameter cannot be null or empty." });
        }

        // Delegate query execution and filtering to the reservation service
        var history = await _reservationService.GetHistoryAsync(nic, status, fromDate, toDate, search);
        return Ok(history);
    }
}
