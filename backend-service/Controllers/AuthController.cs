/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Controller handling user authentication and login endpoints.
 * Last Modified: 2026-09-23
 */

using System.Security.Claims;
using backend_service.DTOs;
using backend_service.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend_service.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthenticationService _authenticationService;

    public AuthController(IAuthenticationService authenticationService)
    {
        // Initialize authentication service dependency.
        _authenticationService = authenticationService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto request, CancellationToken cancellationToken)
    {
        // Delegate authentication to the authentication service and return JWT response.
        var response = await _authenticationService.AuthenticateAsync(request, cancellationToken);
        return Ok(response);
    }

    [HttpPost("register-prosumer")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RegisterProsumerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RegisterProsumerResponse>> RegisterProsumer([FromBody] RegisterProsumerRequest request, CancellationToken cancellationToken)
    {
        // Delegate prosumer registration to authentication service and return 201 Created.
        var response = await _authenticationService.RegisterProsumerAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(AuthenticatedUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuthenticatedUserDto>> GetCurrentUser(CancellationToken cancellationToken)
    {
        // Resolve user identity claim and query live database record to guarantee active status.
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new { message = "User identifier claim is missing from token." });
        }

        var profile = await _authenticationService.GetCurrentProfileAsync(userId, cancellationToken);
        return Ok(profile);
    }
}
