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
}
