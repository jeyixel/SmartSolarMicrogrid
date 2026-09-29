/*
 * Student Component: Member 4 - Grid Operations, QR & Dashboards
 * File Purpose: Data transfer object for prosumer dashboard statistics
 */

namespace backend_service.DTOs;

public class DashboardStatsDto
{
    /// <summary>Number of reservations currently in Pending status awaiting confirmation.</summary>
    public int PendingCount { get; set; }

    /// <summary>Number of approved or confirmed reservations with future start times.</summary>
    public int UpcomingApprovedCount { get; set; }

    /// <summary>Total number of lifetime reservations made by the prosumer.</summary>
    public int TotalBookingsCount { get; set; }
}

