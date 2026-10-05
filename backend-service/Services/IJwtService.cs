/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Contract for generating secure JSON Web Tokens (JWT).
 * Last Modified: 2026-09-22
 */

using backend_service.Models;

namespace backend_service.Services;

public interface IJwtService
{
    /// <summary>
    /// Generates a signed JWT for the authenticated user containing minimal, safe claims.
    /// </summary>
    /// <param name="user">Authenticated user entity.</param>
    /// <param name="expiresAt">The exact UTC expiration timestamp of the generated token.</param>
    /// <returns>Signed JWT string.</returns>
    string GenerateToken(User user, out DateTime expiresAt);
}
