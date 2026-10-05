/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Automated development seeder for creating the initial Backoffice administrator account.
 * Last Modified: 2026-09-22
 */

using backend_service.Models;
using backend_service.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace backend_service.Services;

public class DevelopmentAdminSeeder
{
    private readonly IHostEnvironment _environment;
    private readonly IMongoCollection<User> _usersCollection;
    private readonly IPasswordService _passwordService;
    private readonly BootstrapAdminSettings _adminSettings;
    private readonly ILogger<DevelopmentAdminSeeder> _logger;

    public DevelopmentAdminSeeder(
        IHostEnvironment environment,
        IMongoDatabase database,
        IPasswordService passwordService,
        IOptions<BootstrapAdminSettings> adminOptions,
        IOptions<MongoDbSettings> mongoOptions,
        ILogger<DevelopmentAdminSeeder> logger)
    {
        // Initialize dependencies and resolve the MongoDB users collection.
        _environment = environment;
        _passwordService = passwordService;
        _adminSettings = adminOptions.Value;
        _logger = logger;

        var collectionName = mongoOptions.Value.UsersCollectionName;
        if (string.IsNullOrWhiteSpace(collectionName))
        {
            collectionName = "UserDetails";
        }

        _usersCollection = database.GetCollection<User>(collectionName);
    }

    public async Task SeedAsync()
    {
        // Execute development bootstrap seeding pipeline with strict validation and idempotent checks.
        if (!_environment.IsDevelopment())
        {
            return;
        }

        if (!_adminSettings.Enabled)
        {
            _logger.LogInformation("Bootstrap admin seeding is disabled in configuration.");
            return;
        }

        var email = _adminSettings.Email?.Trim() ?? string.Empty;
        var nic = _adminSettings.NIC?.Trim() ?? string.Empty;
        var phoneNumber = _adminSettings.PhoneNumber?.Trim() ?? string.Empty;
        var fullName = _adminSettings.FullName?.Trim() ?? string.Empty;
        var password = _adminSettings.Password?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(nic) || string.IsNullOrWhiteSpace(fullName))
        {
            _logger.LogWarning("Bootstrap admin seeding skipped: Email, NIC, and FullName must be configured.");
            return;
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            _logger.LogWarning("Bootstrap admin seeding skipped: Password not provided in User Secrets or environment configuration.");
            return;
        }

        var normalizedEmail = email.ToLowerInvariant();

        // Check if administrator account already exists by Id (NIC), normalized email, or NIC
        var filter = Builders<User>.Filter.Or(
            Builders<User>.Filter.Eq(u => u.Id, nic),
            Builders<User>.Filter.Eq(u => u.NormalizedEmail, normalizedEmail),
            Builders<User>.Filter.Eq(u => u.Email, email),
            Builders<User>.Filter.Eq(u => u.NIC, nic)
        );

        var existingUser = await _usersCollection.Find(filter).FirstOrDefaultAsync();
        if (existingUser != null)
        {
            _logger.LogInformation("Bootstrap admin account already exists. Skipping seed.");
            return;
        }

        // Validate password strength against security policy
        if (!_passwordService.ValidatePasswordStrength(password, out var errorMessage))
        {
            _logger.LogError("Bootstrap admin password does not satisfy complexity requirements: {Error}", errorMessage);
            return;
        }

        var passwordHash = _passwordService.HashPassword(password);
        var utcNow = DateTime.UtcNow;

        var adminUser = new User
        {
            Id = nic,
            FullName = fullName,
            Email = email,
            NormalizedEmail = normalizedEmail,
            PhoneNumber = phoneNumber,
            NIC = nic,
            PasswordHash = passwordHash,
            Role = UserRole.Backoffice,
            Status = AccountStatus.Active,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        await _usersCollection.InsertOneAsync(adminUser);
        _logger.LogInformation("Bootstrap administrator account seeded successfully with Backoffice role and Active status.");
    }
}
