/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Implementation of password hashing, verification, and policy enforcement.
 * Last Modified: 2026-09-22
 */

using Microsoft.AspNetCore.Identity;

namespace backend_service.Services;

public class PasswordService : IPasswordService
{
    private readonly PasswordHasher<object> _passwordHasher;
    private static readonly object DummyUser = new();

    public PasswordService()
    {
        // Initialize ASP.NET Core Identity's adaptive password hasher (PBKDF2 with HMAC-SHA512).
        _passwordHasher = new PasswordHasher<object>();
    }

    public bool ValidatePasswordStrength(string? password, out string? errorMessage)
    {
        // Validate password against length, complexity, whitespace, and character class rules.
        errorMessage = null;

        if (string.IsNullOrWhiteSpace(password))
        {
            errorMessage = "Password cannot be empty or contain only whitespace.";
            return false;
        }

        if (password != password.Trim())
        {
            errorMessage = "Password cannot begin or end with whitespace characters.";
            return false;
        }

        if (password.Length < 8)
        {
            errorMessage = "Password must be at least 8 characters long.";
            return false;
        }

        if (password.Length > 72)
        {
            errorMessage = "Password cannot exceed 72 characters.";
            return false;
        }

        if (!password.Any(char.IsUpper))
        {
            errorMessage = "Password must contain at least one uppercase letter.";
            return false;
        }

        if (!password.Any(char.IsLower))
        {
            errorMessage = "Password must contain at least one lowercase letter.";
            return false;
        }

        if (!password.Any(char.IsDigit))
        {
            errorMessage = "Password must contain at least one numerical digit.";
            return false;
        }

        if (!password.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            errorMessage = "Password must contain at least one special character.";
            return false;
        }

        return true;
    }

    public string HashPassword(string password)
    {
        // Hash the supplied password using salted PBKDF2 key derivation.
        if (!ValidatePasswordStrength(password, out var error))
        {
            throw new ArgumentException(error ?? "Password does not satisfy complexity requirements.", nameof(password));
        }

        return _passwordHasher.HashPassword(DummyUser, password);
    }

    public bool VerifyPassword(string password, string storedHash)
    {
        // Verify candidate plaintext password against stored adaptive hash.
        return VerifyPassword(password, storedHash, out _);
    }

    public bool VerifyPassword(string password, string storedHash, out bool rehashNeeded)
    {
        // Verify candidate plaintext password against stored adaptive hash in constant time and check rehash status.
        rehashNeeded = false;

        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(storedHash))
        {
            return false;
        }

        var result = _passwordHasher.VerifyHashedPassword(DummyUser, storedHash, password);

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            rehashNeeded = true;
            return true;
        }

        return result == PasswordVerificationResult.Success;
    }
}
