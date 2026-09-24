/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Contract for password validation, hashing, and verification.
 * Last Modified: 2026-09-22
 */

namespace backend_service.Services;

public interface IPasswordService
{
    /// <summary>
    /// Validates password complexity, length, and format rules.
    /// </summary>
    /// <param name="password">Candidate plaintext password.</param>
    /// <param name="errorMessage">Detailed error message if validation fails.</param>
    /// <returns>True if password meets all policy requirements; otherwise, false.</returns>
    bool ValidatePasswordStrength(string? password, out string? errorMessage);

    /// <summary>
    /// Generates a cryptographically secure salted hash for a validated password.
    /// </summary>
    /// <param name="password">Plaintext password satisfying policy requirements.</param>
    /// <returns>PBKDF2 salted hash string.</returns>
    string HashPassword(string password);

    /// <summary>
    /// Verifies candidate plaintext password against stored adaptive hash in constant time.
    /// </summary>
    /// <param name="password">Candidate plaintext password.</param>
    /// <param name="storedHash">Stored PBKDF2 password hash.</param>
    /// <returns>True if password matches hash; otherwise, false.</returns>
    bool VerifyPassword(string password, string storedHash);

    /// <summary>
    /// Verifies password against stored hash and indicates whether rehashing is recommended.
    /// </summary>
    /// <param name="password">Candidate plaintext password.</param>
    /// <param name="storedHash">Stored password hash.</param>
    /// <param name="rehashNeeded">True if hashing algorithm parameters have been upgraded and hash should be refreshed.</param>
    /// <returns>True if password matches hash; otherwise, false.</returns>
    bool VerifyPassword(string password, string storedHash, out bool rehashNeeded);
}
