/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Implementation of user authentication, credential verification, and status validation.
 * Last Modified: 2026-09-22
 */

using backend_service.DTOs;
using backend_service.Exceptions;
using backend_service.Models;
using backend_service.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace backend_service.Services;

public class AuthenticationService : IAuthenticationService
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly IPasswordService _passwordService;
    private readonly IJwtService _jwtService;
    private readonly ILogger<AuthenticationService> _logger;
    private static readonly string DummyPasswordHash = new PasswordService().HashPassword("Dummy#Pass123");

    public AuthenticationService(
        IMongoDatabase database,
        IOptions<MongoDbSettings> mongoOptions,
        IPasswordService passwordService,
        IJwtService jwtService,
        ILogger<AuthenticationService> logger)
    {
        // Initialize dependencies and resolve MongoDB users collection.
        var collectionName = mongoOptions.Value.UsersCollectionName;
        if (string.IsNullOrWhiteSpace(collectionName))
        {
            collectionName = "UserDetails";
        }

        _usersCollection = database.GetCollection<User>(collectionName);
        _passwordService = passwordService;
        _jwtService = jwtService;
        _logger = logger;
    }

    public async Task<LoginResponseDto> AuthenticateAsync(LoginRequestDto request, CancellationToken cancellationToken = default)
    {
        // Execute authentication pipeline: input validation, exact index lookup, timing-safe hash check, status check, and token issue.
        if (request == null || string.IsNullOrWhiteSpace(request.Identifier) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new ArgumentException("Email/NIC and password are required.");
        }

        var normalizedIdentifier = request.Identifier.Trim();
        var normalizedEmail = normalizedIdentifier.ToUpperInvariant();

        // Exact match lookup on indexed fields (NormalizedEmail, Email, NIC) avoiding unindexed regex scans
        var filter = Builders<User>.Filter.Or(
            Builders<User>.Filter.Eq(u => u.NormalizedEmail, normalizedEmail),
            Builders<User>.Filter.Eq(u => u.Email, normalizedIdentifier),
            Builders<User>.Filter.Eq(u => u.NIC, normalizedIdentifier)
        );

        var user = await _usersCollection.Find(filter).FirstOrDefaultAsync(cancellationToken);

        // Mitigate timing difference attacks: compute hash verification even if user does not exist
        var storedHashToVerify = user?.PasswordHash ?? DummyPasswordHash;
        var isPasswordValid = _passwordService.VerifyPassword(request.Password, storedHashToVerify, out var rehashNeeded);

        // Generic 401 error for non-existent user or invalid password
        if (user == null || !isPasswordValid)
        {
            _logger.LogWarning("Authentication failed for identifier lookup.");
            throw new UnauthorizedAccessException("Invalid email/NIC or password.");
        }

        // Require Active status explicitly
        if (user.Status != AccountStatus.Active)
        {
            if (user.Status == AccountStatus.Pending)
            {
                _logger.LogInformation("Login blocked for user {UserId}: Account pending approval.", user.Id);
                throw new AccountStatusException(AccountStatus.Pending, "Account activation is pending administrator approval.");
            }

            if (user.Status == AccountStatus.Deactivated)
            {
                _logger.LogInformation("Login blocked for user {UserId}: Account deactivated.", user.Id);
                throw new AccountStatusException(AccountStatus.Deactivated, "Account has been deactivated. Please contact support.");
            }

            throw new AccountStatusException(user.Status, "Account is not active.");
        }

        // Update password hash asynchronously if upgraded work factor / parameters require rehash
        if (rehashNeeded)
        {
            try
            {
                var newHash = _passwordService.HashPassword(request.Password);
                var update = Builders<User>.Update.Set(u => u.PasswordHash, newHash);
                await _usersCollection.UpdateOneAsync(u => u.Id == user.Id, update, cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update rehashed password for user {UserId}.", user.Id);
            }
        }

        // Generate signed JWT and synchronize exact expiration timestamp
        var token = _jwtService.GenerateToken(user, out var expiresAt);

        return new LoginResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = new AuthenticatedUserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                NIC = user.NIC,
                Role = user.Role.ToString(),
                Status = user.Status.ToString()
            }
        };
    }
}
