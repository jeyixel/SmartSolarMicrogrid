/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Exception thrown when an account is not in Active state during authentication.
 * Last Modified: 2026-09-22
 */

using backend_service.Models;

namespace backend_service.Exceptions;

public class AccountStatusException : Exception
{
    public AccountStatus Status { get; }

    public AccountStatusException(AccountStatus status, string message) : base(message)
    {
        Status = status;
    }
}
