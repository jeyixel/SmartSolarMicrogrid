/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Controller handling self-service prosumer profile updates.
 * Last Modified: 2026-09-23
 */

using System.Security.Claims;
using backend_service.DTOs;
using backend_service.Models;
using backend_service.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace backend_service.Controllers;

[ApiController]
[Route("api/prosumer/profile")]
[Authorize(Policy = "RequireProsumerRole")]
public class ProsumerProfileController : ControllerBase
{
    private readonly IMongoCollection<User> _usersCollection;

    public ProsumerProfileController(
        IMongoDatabase database,
        IOptions<MongoDbSettings> mongoOptions)
    {
        var collectionName = mongoOptions.Value.UsersCollectionName;

        if (string.IsNullOrWhiteSpace(collectionName))
        {
            collectionName = "UserDetails";
        }

        _usersCollection = database.GetCollection<User>(collectionName);
    }

    [HttpPut]
    public async Task<ActionResult<UserResponseDto>> UpdateMyProfile(
        [FromBody] UpdateUserProfileRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new { message = "User identity is missing." });
        }

        var email = request.Email.Trim();
        var normalizedEmail = email.ToLowerInvariant();

        var duplicateEmail = await _usersCollection
            .Find(user =>
                user.NormalizedEmail == normalizedEmail &&
                user.Id != userId)
            .AnyAsync(cancellationToken);

        if (duplicateEmail)
        {
            return Conflict(new { message = "Email is already in use." });
        }

        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(user => user.Id, userId),
            Builders<User>.Filter.Eq(user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(user => user.Status, AccountStatus.Active)
        );

        var update = Builders<User>.Update
            .Set(user => user.FullName, request.FullName.Trim())
            .Set(user => user.Email, email)
            .Set(user => user.NormalizedEmail, normalizedEmail)
            .Set(user => user.PhoneNumber, request.PhoneNumber.Trim())
            .Set(user => user.Address, request.Address.Trim())
            .Set(user => user.UpdatedAt, DateTime.UtcNow);

        try
        {
            var updatedUser = await _usersCollection.FindOneAndUpdateAsync(
                filter,
                update,
                new FindOneAndUpdateOptions<User>
                {
                    ReturnDocument = ReturnDocument.After
                },
                cancellationToken);

            if (updatedUser is null)
            {
                return Conflict(new
                {
                    message = "An active prosumer account is required."
                });
            }

            return Ok(UserResponseDto.FromUser(updatedUser));
        }
        catch (MongoCommandException ex) when (ex.Code == 11000)
        {
            return Conflict(new { message = "Email is already in use." });
        }
    }

    [HttpPost("/api/prosumer/account/deactivation-request")]
    public async Task<ActionResult<UserResponseDto>> RequestDeactivation(
        CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new { message = "User identity is missing." });
        }

        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(user => user.Id, userId),
            Builders<User>.Filter.Eq(user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(user => user.Status, AccountStatus.Active),
            Builders<User>.Filter.Eq(
                user => user.DeactivationRequestedAt, null)
        );

        var now = DateTime.UtcNow;

        var update = Builders<User>.Update
            .Set(user => user.DeactivationRequestedAt, now)
            .Set(user => user.UpdatedAt, now);

        var updatedUser = await _usersCollection.FindOneAndUpdateAsync(
            filter,
            update,
            new FindOneAndUpdateOptions<User>
            {
                ReturnDocument = ReturnDocument.After
            },
            cancellationToken);

        if (updatedUser is null)
        {
            return Conflict(new
            {
                message = "Account is not active or deactivation was already requested."
            });
        }

        return Ok(UserResponseDto.FromUser(updatedUser));
    }
}
