/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Implementation of secure JWT generation service.
 * Last Modified: 2026-09-22
 */

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using backend_service.Models;
using backend_service.Settings;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace backend_service.Services;

public class JwtService : IJwtService
{
    private readonly JwtSettings _jwtSettings;

    public JwtService(IOptions<JwtSettings> jwtOptions)
    {
        // Initialize and validate JWT configuration options.
        _jwtSettings = jwtOptions.Value;

        if (string.IsNullOrWhiteSpace(_jwtSettings.Issuer))
        {
            throw new InvalidOperationException("JWT Issuer must be configured and cannot be empty.");
        }

        if (string.IsNullOrWhiteSpace(_jwtSettings.Audience))
        {
            throw new InvalidOperationException("JWT Audience must be configured and cannot be empty.");
        }

        if (string.IsNullOrWhiteSpace(_jwtSettings.SecretKey) || Encoding.UTF8.GetByteCount(_jwtSettings.SecretKey) < 32)
        {
            throw new InvalidOperationException("JWT SecretKey must be configured with at least 32 bytes (256 bits).");
        }

        if (_jwtSettings.ExpiryMinutes <= 0)
        {
            throw new InvalidOperationException("JWT ExpiryMinutes must be greater than zero.");
        }
    }

    public string GenerateToken(User user, out DateTime expiresAt)
    {
        // Build claim payload with non-sensitive user identity attributes and generate signed JWT.
        expiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpiryMinutes);

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("nic", user.NIC),
            new("status", user.Status.ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            SigningCredentials = credentials
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);

        return tokenHandler.WriteToken(token);
    }
}
