package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Data Transfer Object for prosumer dashboard statistics.
 * Holds pending reservation counts and approved upcoming reservation counts.
 */
data class DashboardStatsDto(
    val pendingCount: Int,
    val upcomingApprovedCount: Int,
    val totalBookingsCount: Int
) {
    companion object {
        fun fromJson(json: JSONObject): DashboardStatsDto {
            return DashboardStatsDto(
                pendingCount = json.optInt("pendingCount", 0),
                upcomingApprovedCount = json.optInt("upcomingApprovedCount", 0),
                totalBookingsCount = json.optInt("totalBookingsCount", 0)
            )
        }
    }
}
