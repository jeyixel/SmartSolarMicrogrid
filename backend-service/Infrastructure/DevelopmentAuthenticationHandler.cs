using System.Security.Claims;
using System.Text.Encodings.Web;
using backend_service.Abstractions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace backend_service.Infrastructure;

/// <summary>
/// Stand-in authentication for local development, used only until Member 1's
/// scheme is registered. It reads the caller's identity from two request
/// headers so the station endpoints can be exercised in Postman before the
/// identity module exists:
/// <list type="bullet">
///   <item><c>X-Debug-Role</c> — Backoffice, GridOperator or Prosumer</item>
///   <item><c>X-Debug-UserId</c> — any string, stamped into the audit fields</item>
/// </list>
/// </summary>
/// <remarks>
/// This is registered only in the Development environment (see Program.cs).
/// It trusts a plain header and is not authentication in any real sense —
/// enabling it outside development would let any caller claim any role. Delete
/// this class once Member 1's scheme is in place.
/// </remarks>
public sealed class DevelopmentAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "DevelopmentHeader";
    public const string RoleHeader = "X-Debug-Role";
    public const string UserIdHeader = "X-Debug-UserId";

    public DevelopmentAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // No role header means no caller: endpoints then answer 401, matching
        // how a missing token will behave once Member 1's scheme is in place.
        if (!Request.Headers.TryGetValue(RoleHeader, out var roleValues))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var role = roleValues.ToString().Trim();

        var knownRoles = new[]
        {
            ApplicationRoles.Backoffice,
            ApplicationRoles.GridOperator,
            ApplicationRoles.Prosumer
        };

        var matched = knownRoles.FirstOrDefault(r => r.Equals(role, StringComparison.OrdinalIgnoreCase));
        if (matched is null)
        {
            return Task.FromResult(AuthenticateResult.Fail(
                $"'{role}' is not a recognised role. Use one of: {string.Join(", ", knownRoles)}."));
        }

        var userId = Request.Headers.TryGetValue(UserIdHeader, out var userValues)
                     && !string.IsNullOrWhiteSpace(userValues.ToString())
            ? userValues.ToString().Trim()
            : "dev-user";

        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Role, matched)
            },
            SchemeName);

        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
