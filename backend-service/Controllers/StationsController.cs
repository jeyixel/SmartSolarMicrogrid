using System.Security.Claims;
using backend_service.Abstractions;
using backend_service.Dtos;
using backend_service.Infrastructure;
using backend_service.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend_service.Controllers;

/// <summary>
/// HTTP surface of the microgrid node module. Binds the request, reads the
/// caller's identity from the authenticated principal, calls one service method,
/// and maps the outcome to a status code. No business decisions are made here.
/// </summary>
[ApiController]
[Route("api/stations")]
[Authorize]
[Produces("application/json")]
public sealed class StationsController : ControllerBase
{
    private readonly IStationService _stationService;

    public StationsController(IStationService stationService)
    {
        _stationService = stationService;
    }

    // ── Backoffice management ────────────────────────────────────────────────

    /// <summary>Registers a new microgrid node.</summary>
    [HttpPost]
    [Authorize(Roles = ApplicationRoles.Backoffice)]
    [ProducesResponseType(typeof(StationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateStationRequest request, CancellationToken cancellationToken)
    {
        var result = await _stationService.CreateAsync(request, GetUserId(), cancellationToken);

        if (!result.Succeeded)
        {
            return result.ToErrorResult(HttpContext);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Full station document for staff. A Prosumer reaching this route is served
    /// the public projection, and sees a station that is not active as absent.
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(StationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken cancellationToken)
    {
        if (!IsStaff())
        {
            var publicResult = await _stationService.GetPublicDetailAsync(id, cancellationToken);
            return publicResult.Succeeded
                ? Ok(publicResult.Value)
                : publicResult.ToErrorResult(HttpContext);
        }

        var result = await _stationService.GetByIdAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    /// <summary>Paged management list. Includes every status, not just active nodes.</summary>
    [HttpGet]
    [Authorize(Roles = ApplicationRoles.BackofficeOrGridOperator)]
    [ProducesResponseType(typeof(PagedResponse<StationSummaryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetAll(
        [FromQuery] StationListQuery query, CancellationToken cancellationToken)
    {
        var result = await _stationService.GetPagedAsync(query, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    /// <summary>
    /// Updates a station. Backoffice may change every editable field; a Grid
    /// Operator is limited to available slots, contact phone and the schedule.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = ApplicationRoles.BackofficeOrGridOperator)]
    [ProducesResponseType(typeof(StationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        string id, [FromBody] UpdateStationRequest request, CancellationToken cancellationToken)
    {
        var result = await _stationService.UpdateAsync(
            id, request, GetUserId(), IsBackoffice(), cancellationToken);

        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    /// <summary>
    /// Takes a node out of service. Refused while the reservation module reports
    /// active reservations against it, and refused outright if that module
    /// cannot be reached.
    /// </summary>
    [HttpPatch("{id}/deactivate")]
    [Authorize(Roles = ApplicationRoles.Backoffice)]
    [ProducesResponseType(typeof(StationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Deactivate(
        string id, [FromBody] DeactivateStationRequest? request, CancellationToken cancellationToken)
    {
        var result = await _stationService.DeactivateAsync(
            id, request?.Reason, GetUserId(), cancellationToken);

        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    /// <summary>Returns a node to service. No reservation check is needed.</summary>
    [HttpPatch("{id}/activate")]
    [Authorize(Roles = ApplicationRoles.Backoffice)]
    [ProducesResponseType(typeof(StationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Activate(string id, CancellationToken cancellationToken)
    {
        var result = await _stationService.ActivateAsync(id, GetUserId(), cancellationToken);
        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    /// <summary>
    /// Read-only pre-check, so the web client can warn the operator before the
    /// deactivate button is pressed rather than failing at the moment of action.
    /// </summary>
    [HttpGet("{id}/deactivation-eligibility")]
    [Authorize(Roles = ApplicationRoles.Backoffice)]
    [ProducesResponseType(typeof(DeactivationEligibilityResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetDeactivationEligibility(string id, CancellationToken cancellationToken)
    {
        var result = await _stationService.GetDeactivationEligibilityAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    // ── Mobile / location ────────────────────────────────────────────────────

    /// <summary>
    /// Marker feed for the Android map: active stations within a radius, nearest
    /// first. An empty list means nothing is nearby, which is a valid answer.
    /// </summary>
    [HttpGet("nearby")]
    [ProducesResponseType(typeof(List<StationMapSummaryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetNearby(
        [FromQuery] NearbyStationQuery query, CancellationToken cancellationToken)
    {
        var result = await _stationService.GetNearbyAsync(query, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    /// <summary>Public detail shown after a map marker is tapped.</summary>
    [HttpGet("{id}/details")]
    [ProducesResponseType(typeof(StationDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDetails(string id, CancellationToken cancellationToken)
    {
        var result = await _stationService.GetPublicDetailAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    /// <summary>
    /// Id, code and name of every active station — for the station dropdowns in
    /// the reservation and grid-operations modules.
    /// </summary>
    [HttpGet("lookup")]
    [ProducesResponseType(typeof(List<StationLookupResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLookup(CancellationToken cancellationToken)
    {
        var result = await _stationService.GetLookupAsync(cancellationToken);
        return result.Succeeded ? Ok(result.Value) : result.ToErrorResult(HttpContext);
    }

    // ── Identity helpers ─────────────────────────────────────────────────────

    /// <summary>
    /// The caller's user id, taken from the token's claims. Never from a header,
    /// query parameter or request body — a client-supplied identity is a
    /// client-controlled identity.
    /// </summary>
    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? User.FindFirstValue("userId")
        ?? "unknown";

    private bool IsBackoffice() => User.IsInRole(ApplicationRoles.Backoffice);

    private bool IsStaff() =>
        User.IsInRole(ApplicationRoles.Backoffice) || User.IsInRole(ApplicationRoles.GridOperator);
}
