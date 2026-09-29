namespace backend_service.Models;

/// <summary>
/// Lifecycle state of a microgrid node. Stored as a string in MongoDB so the
/// documents stay readable in Compass and survive re-ordering of the enum.
/// </summary>
public enum StationStatus
{
    Active,
    Inactive,
    Maintenance
}
