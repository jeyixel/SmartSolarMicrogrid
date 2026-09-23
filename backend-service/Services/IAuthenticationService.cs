/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Contract for user authentication and login orchestration.
 * Last Modified: 2026-09-22
 */

using backend_service.DTOs;

namespace backend_service.Services;

public interface IAuthenticationService
{
    /// <summary>
    /// Authenticates user credentials, validates account status, and generates a JWT.
    /// </summary>
    /// <param name="request">Login request containing email/NIC identifier and password.</param>
    /// <param name="cancellationToken">Cancellation token for asynchronous database operations.</param>
    /// <returns>Login response with JWT, expiration timestamp, and safe user profile.</returns>
    Task<LoginResponseDto> AuthenticateAsync(LoginRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the current live user profile and validates active status against the database.
    /// </summary>
    /// <param name="userId">The unique identifier of the user.</param>
    /// <param name="cancellationToken">Cancellation token for asynchronous database operations.</param>
    /// <returns>Current authenticated user profile summary.</returns>
    Task<AuthenticatedUserDto> GetCurrentProfileAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Registers a new prosumer account with pending approval status.
    /// </summary>
    /// <param name="request">Registration request containing prosumer details and password.</param>
    /// <param name="cancellationToken">Cancellation token for asynchronous database operations.</param>
    /// <returns>Registration confirmation with assigned user ID and pending status.</returns>
    Task<RegisterProsumerResponse> RegisterProsumerAsync(RegisterProsumerRequest request, CancellationToken cancellationToken = default);
}
