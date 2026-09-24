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
        var normalizedEmail = normalizedIdentifier.ToLowerInvariant();

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
                NIC = user.NIC,
                Role = user.Role.ToString(),
                Status = user.Status.ToString()
            }
        };
    }

    public async Task<AuthenticatedUserDto> GetCurrentProfileAsync(string userId, CancellationToken cancellationToken = default)
    {
        // Fetch current live user record from database and verify that account is currently Active.
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedAccessException("User identifier claim is required.");
        }

        var user = await _usersCollection.Find(u => u.Id == userId).FirstOrDefaultAsync(cancellationToken);

        if (user == null)
        {
            throw new UnauthorizedAccessException("User account does not exist.");
        }

        if (user.Status != AccountStatus.Active)
        {
            if (user.Status == AccountStatus.Pending)
            {
                throw new AccountStatusException(AccountStatus.Pending, "Account activation is pending administrator approval.");
            }

            if (user.Status == AccountStatus.Deactivated)
            {
                throw new AccountStatusException(AccountStatus.Deactivated, "Account has been deactivated. Please contact support.");
            }

            throw new AccountStatusException(user.Status, "Account is not active.");
        }

        return new AuthenticatedUserDto
        {
            Id = user.Id,
            FullName = user.FullName,
            NIC = user.NIC,
            Role = user.Role.ToString(),
            Status = user.Status.ToString()
        };
    }

    public async Task<RegisterProsumerResponse> RegisterProsumerAsync(RegisterProsumerRequest request, CancellationToken cancellationToken = default)
    {
        // 1. Reject a null request
        if (request == null)
        {
            throw new ArgumentNullException(nameof(request), "Registration request cannot be null.");
        }

        // 2. Trim all text fields
        var fullName = request.FullName?.Trim() ?? string.Empty;
        var rawNic = request.Nic?.Trim() ?? string.Empty;
        var rawEmail = request.Email?.Trim() ?? string.Empty;
        var phoneNumber = request.PhoneNumber?.Trim() ?? string.Empty;
        var address = request.Address?.Trim() ?? string.Empty;
        var password = request.Password ?? string.Empty;

        // 3. Normalize NIC using uppercase (e.g. 991234567v -> 991234567V)
        var normalizedNic = rawNic.ToUpperInvariant();

        // 4. Normalize email using lowercase
        var normalizedEmail = rawEmail.ToLowerInvariant();

        // 5. Call ValidatePasswordStrength
        if (!_passwordService.ValidatePasswordStrength(password, out var passwordError))
        {
            throw new ArgumentException(passwordError ?? "Password does not satisfy complexity requirements.");
        }

        // 6. Check MongoDB for existing Id == normalizedNic or NormalizedEmail == normalizedEmail
        var duplicateFilter = Builders<User>.Filter.Or(
            Builders<User>.Filter.Eq(u => u.Id, normalizedNic),
            Builders<User>.Filter.Eq(u => u.NormalizedEmail, normalizedEmail)
        );

        var existingUser = await _usersCollection.Find(duplicateFilter).FirstOrDefaultAsync(cancellationToken);
        if (existingUser != null)
        {
            if (string.Equals(existingUser.Id, normalizedNic, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(existingUser.NIC, normalizedNic, StringComparison.OrdinalIgnoreCase))
            {
                throw new ConflictException("An account with this NIC already exists.");
            }

            throw new ConflictException("An account with this email already exists.");
        }

        // 7. Hash the password using _passwordService.HashPassword
        var passwordHash = _passwordService.HashPassword(password);

        // 8. Create the user entity
        var now = DateTime.UtcNow;
        var newUser = new User
        {
            Id = normalizedNic,
            FullName = fullName,
            Email = rawEmail,
            NormalizedEmail = normalizedEmail,
            PhoneNumber = phoneNumber,
            Address = address,
            NIC = normalizedNic,
            PasswordHash = passwordHash,
            Role = UserRole.Prosumer,
            Status = AccountStatus.Pending,
            CreatedAt = now,
            UpdatedAt = now
        };

        // 9. Insert user with MongoDB duplicate-key error 11000 handling
        try
        {
            await _usersCollection.InsertOneAsync(newUser, cancellationToken: cancellationToken);
            _logger.LogInformation("Prosumer registration successful for User ID (NIC): {UserId}", normalizedNic);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Code == 11000 || ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            _logger.LogWarning(ex, "Duplicate key collision during prosumer registration for NIC: {NIC}", normalizedNic);
            throw new ConflictException("An account with the supplied NIC or email already exists.");
        }
        catch (MongoException ex) when (ex.Message.Contains("11000") || ex.Message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(ex, "Duplicate key collision during prosumer registration for NIC: {NIC}", normalizedNic);
            throw new ConflictException("An account with the supplied NIC or email already exists.");
        }

        // 10. Return response
        return new RegisterProsumerResponse
        {
            UserId = normalizedNic,
            AccountStatus = AccountStatus.Pending.ToString(),
            Message = "Registration successful. Your account is awaiting Backoffice approval."
        };
    }
}
