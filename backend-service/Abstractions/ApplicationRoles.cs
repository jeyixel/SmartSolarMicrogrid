namespace backend_service.Abstractions;

/// <summary>
/// The role strings carried in the authentication token issued by Member 1.
/// These must match Member 1's issuer exactly, casing included — a mismatch here
/// silently turns every authorised call into a 403.
/// </summary>
public static class ApplicationRoles
{
    public const string Backoffice = "Backoffice";
    public const string GridOperator = "GridOperator";
    public const string Prosumer = "Prosumer";

    public const string BackofficeOrGridOperator = Backoffice + "," + GridOperator;
}
