/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Controller handling user management and administrative backoffice endpoints.
 * Last Modified: 2026-09-23
 */

using System.Security.Claims;
using System.Text.RegularExpressions;
using backend_service.DTOs;
using backend_service.Exceptions;
using backend_service.Models;
using backend_service.Services;
using backend_service.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace backend_service.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = "RequireBackofficeRole")]
public class UsersController : ControllerBase
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly IPasswordService _passwordService;

    public UsersController(
        IMongoDatabase database,
        IOptions<MongoDbSettings> mongoOptions,
        IPasswordService passwordService)
    {
        var collectionName = mongoOptions.Value.UsersCollectionName;

        if (string.IsNullOrWhiteSpace(collectionName))
        {
            collectionName = "UserDetails";
        }

        _usersCollection = database.GetCollection<User>(collectionName);
        _passwordService = passwordService;
    }

    [HttpGet("pending")]
    public async Task<ActionResult<List<UserResponseDto>>> GetPendingRegistrations(
        CancellationToken cancellationToken)
    {
        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(user => user.Status, AccountStatus.Pending)
        );

        var users = await _usersCollection
            .Find(filter)
            .SortBy(user => user.CreatedAt)
            .ToListAsync(cancellationToken);

        var response = users
            .Select(UserResponseDto.FromUser)
            .ToList();

        return Ok(response);
    }

    [HttpGet("deactivation-requests")]
    public async Task<ActionResult<List<UserResponseDto>>> GetDeactivationRequests(
        CancellationToken cancellationToken)
    {
        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(user => user.Status, AccountStatus.Active),
            Builders<User>.Filter.Ne(user => user.DeactivationRequestedAt, null)
        );

        var users = await _usersCollection
            .Find(filter)
            .SortBy(user => user.DeactivationRequestedAt)
            .ToListAsync(cancellationToken);

        var response = users
            .Select(UserResponseDto.FromUser)
            .ToList();

        return Ok(response);
    }

    [HttpGet]
    public async Task<ActionResult<PagedUsersResponseDto>> GetAllUsers(
        [FromQuery] string? search,
        [FromQuery] UserRole? role,
        [FromQuery] AccountStatus? status,
        [FromQuery] bool? deactivationRequestsOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100 ||
            (long)(page - 1) * pageSize > int.MaxValue)
        {
            return BadRequest(new
            {
                message = "Page must be at least 1 and pageSize must be between 1 and 100."
            });
        }

        if (role.HasValue && !Enum.IsDefined(role.Value))
        {
            return BadRequest(new { message = "Invalid role." });
        }

        if (status.HasValue && !Enum.IsDefined(status.Value))
        {
            return BadRequest(new { message = "Invalid account status." });
        }

        var builder = Builders<User>.Filter;
        var filter = builder.Empty;

        if (role.HasValue)
        {
            filter &= builder.Eq(user => user.Role, role.Value);
        }

        if (status.HasValue)
        {
            filter &= builder.Eq(user => user.Status, status.Value);
        }

        if (deactivationRequestsOnly.HasValue && deactivationRequestsOnly.Value)
        {
            filter &= builder.Ne(user => user.DeactivationRequestedAt, null);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            if (term.Length > 100)
            {
                return BadRequest(new { message = "Search cannot exceed 100 characters." });
            }

            // Escape regex characters so the search text is treated literally.
            var pattern = Regex.Escape(term);

            filter &= builder.Or(
                builder.Regex(
                    user => user.FullName,
                    new BsonRegularExpression(pattern, "i")),
                builder.Regex(
                    user => user.NormalizedEmail,
                    new BsonRegularExpression(pattern.ToLowerInvariant())),
                builder.Regex(
                    user => user.NIC,
                    new BsonRegularExpression(pattern, "i"))
            );
        }

        var total = await _usersCollection.CountDocumentsAsync(
            filter,
            cancellationToken: cancellationToken);

        var users = await _usersCollection
            .Find(filter)
            .SortBy(user => user.Id)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return Ok(new PagedUsersResponseDto
        {
            Items = users.Select(UserResponseDto.FromUser).ToList(),
            Total = total,
            Page = page,
            PageSize = pageSize
        });
    }

    [HttpGet("{nic}")]
    public async Task<ActionResult<UserResponseDto>> GetUserByNic(
        string nic,
        CancellationToken cancellationToken)
    {
        var normalizedNic = nic.Trim().ToUpperInvariant();

        var user = await _usersCollection
            .Find(u => u.Id == normalizedNic)
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        return Ok(UserResponseDto.FromUser(user));
    }

    [HttpPost("staff")]
    public async Task<ActionResult<UserResponseDto>> CreateStaffUser(
        [FromBody] CreateStaffUserRequestDto request,
        CancellationToken cancellationToken)
    {
        var role = request.Role switch
        {
            "Backoffice" => UserRole.Backoffice,
            "GridOperator" => UserRole.GridOperator,
            _ => throw new ArgumentException(
                "Role must be Backoffice or GridOperator.")
        };

        var nic = request.Nic.Trim().ToUpperInvariant();
        var email = request.Email.Trim();
        var normalizedEmail = email.ToLowerInvariant();

        if (!_passwordService.ValidatePasswordStrength(
                request.Password, out var passwordError))
        {
            return BadRequest(new { message = passwordError });
        }

        var duplicateFilter = Builders<User>.Filter.Or(
            Builders<User>.Filter.Eq(user => user.Id, nic),
            Builders<User>.Filter.Eq(
                user => user.NormalizedEmail, normalizedEmail)
        );

        var existingUser = await _usersCollection
            .Find(duplicateFilter)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingUser is not null)
        {
            return Conflict(new { message = "NIC or email already exists." });
        }

        var now = DateTime.UtcNow;

        var staffUser = new User
        {
            Id = nic,
            NIC = nic,
            FullName = request.FullName.Trim(),
            Email = email,
            NormalizedEmail = normalizedEmail,
            PhoneNumber = request.PhoneNumber.Trim(),
            PasswordHash = _passwordService.HashPassword(request.Password),
            Role = role,
            Status = AccountStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            await _usersCollection.InsertOneAsync(
                staffUser,
                cancellationToken: cancellationToken);
        }
        catch (MongoWriteException ex)
            when (ex.WriteError?.Code == 11000)
        {
            return Conflict(new { message = "NIC or email already exists." });
        }

        return CreatedAtAction(
            nameof(GetUserByNic),
            new { nic = staffUser.NIC },
            UserResponseDto.FromUser(staffUser));
    }

    [HttpPost("{nic}/activate")]
    public async Task<ActionResult<UserResponseDto>> ActivateProsumer(
        string nic,
        CancellationToken cancellationToken)
    {
        var normalizedNic = nic.Trim().ToUpperInvariant();
        var backofficeUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(backofficeUserId))
        {
            return Unauthorized(new { message = "User identity is missing." });
        }

        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(user => user.Id, normalizedNic),
            Builders<User>.Filter.Eq(user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(user => user.Status, AccountStatus.Pending)
        );

        var now = DateTime.UtcNow;

        var update = Builders<User>.Update
            .Set(user => user.Status, AccountStatus.Active)
            .Set(user => user.ActivatedAt, now)
            .Set(user => user.ActivatedBy, backofficeUserId)
            .Set(user => user.UpdatedAt, now);

        var activatedUser = await _usersCollection.FindOneAndUpdateAsync(
            filter,
            update,
            new FindOneAndUpdateOptions<User>
            {
                ReturnDocument = ReturnDocument.After
            },
            cancellationToken);

        if (activatedUser is null)
        {
            return Conflict(new
            {
                message = "Prosumer does not exist or is not pending activation."
            });
        }

        return Ok(UserResponseDto.FromUser(activatedUser));
    }

    [HttpPut("{nic}")]
    public async Task<ActionResult<UserResponseDto>> UpdateUser(
        string nic,
        [FromBody] UpdateUserProfileRequestDto request,
        CancellationToken cancellationToken)
    {
        var normalizedNic = nic.Trim().ToUpperInvariant();
        var email = request.Email.Trim();
        var normalizedEmail = email.ToLowerInvariant();

        var duplicateEmail = await _usersCollection
            .Find(user =>
                user.NormalizedEmail == normalizedEmail &&
                user.Id != normalizedNic)
            .AnyAsync(cancellationToken);

        if (duplicateEmail)
        {
            return Conflict(new { message = "Email is already in use." });
        }

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
                user => user.Id == normalizedNic,
                update,
                new FindOneAndUpdateOptions<User>
                {
                    ReturnDocument = ReturnDocument.After
                },
                cancellationToken);

            if (updatedUser is null)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(UserResponseDto.FromUser(updatedUser));
        }
        catch (MongoCommandException ex) when (ex.Code == 11000)
        {
            return Conflict(new { message = "Email is already in use." });
        }
    }

    [HttpPost("{nic}/deactivation/approve")]
    public async Task<ActionResult<UserResponseDto>> ApproveDeactivation(
        string nic,
        CancellationToken cancellationToken)
    {
        var backofficeUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(backofficeUserId))
        {
            return Unauthorized(new { message = "User identity is missing." });
        }

        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(
                user => user.Id, nic.Trim().ToUpperInvariant()),
            Builders<User>.Filter.Eq(
                user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(
                user => user.Status, AccountStatus.Active),
            Builders<User>.Filter.Ne(
                user => user.DeactivationRequestedAt, null)
        );

        var now = DateTime.UtcNow;

        var update = Builders<User>.Update
            .Set(user => user.Status, AccountStatus.Deactivated)
            .Set(user => user.DeactivationRequestedAt, null)
            .Set(user => user.DeactivatedAt, now)
            .Set(user => user.DeactivatedBy, backofficeUserId)
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
                message = "No active deactivation request exists for this prosumer."
            });
        }

        return Ok(UserResponseDto.FromUser(updatedUser));
    }

    [HttpPost("{nic}/deactivation/reject")]
    public async Task<ActionResult<UserResponseDto>> RejectDeactivation(
        string nic,
        CancellationToken cancellationToken)
    {
        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(
                user => user.Id, nic.Trim().ToUpperInvariant()),
            Builders<User>.Filter.Eq(
                user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(
                user => user.Status, AccountStatus.Active),
            Builders<User>.Filter.Ne(
                user => user.DeactivationRequestedAt, null)
        );

        var update = Builders<User>.Update
            .Set(user => user.DeactivationRequestedAt, null)
            .Set(user => user.UpdatedAt, DateTime.UtcNow);

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
                message = "No active deactivation request exists for this prosumer."
            });
        }

        return Ok(UserResponseDto.FromUser(updatedUser));
    }

    [HttpPost("{nic}/reactivate")]
    public async Task<ActionResult<UserResponseDto>> ReactivateProsumer(
        string nic,
        CancellationToken cancellationToken)
    {
        var backofficeUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(backofficeUserId))
        {
            return Unauthorized(new { message = "User identity is missing." });
        }

        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(
                user => user.Id, nic.Trim().ToUpperInvariant()),
            Builders<User>.Filter.Eq(
                user => user.Role, UserRole.Prosumer),
            Builders<User>.Filter.Eq(
                user => user.Status, AccountStatus.Deactivated)
        );

        var now = DateTime.UtcNow;

        var update = Builders<User>.Update
            .Set(user => user.Status, AccountStatus.Active)
            .Set(user => user.ReactivatedAt, now)
            .Set(user => user.ReactivatedBy, backofficeUserId)
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
                message = "Prosumer does not exist or is not deactivated."
            });
        }

        return Ok(UserResponseDto.FromUser(updatedUser));
    }
}
