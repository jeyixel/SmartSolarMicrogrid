package com.example.smartsolarmicrogrid.data.model

import com.google.gson.annotations.SerializedName

/**
 * One map marker, as returned by GET /api/stations/nearby.
 *
 * Mirrors StationMapSummaryResponse in the C# Web API. The payload is
 * deliberately small because it is fetched every time the map loads; the
 * description, address and schedule arrive later, only when a marker is tapped.
 *
 * Every field is given an explicit @SerializedName rather than relying on the
 * Kotlin property name, so that renaming a property here can never silently
 * break JSON parsing.
 */
data class StationMapSummaryDto(
    @SerializedName("id") val id: String,
    @SerializedName("stationCode") val stationCode: String,
    @SerializedName("name") val name: String,
    // Nullable: a station saved with missing coordinates must be detected and
    // skipped rather than crashing the map.
    @SerializedName("latitude") val latitude: Double?,
    @SerializedName("longitude") val longitude: Double?,
    @SerializedName("capacityKWh") val capacityKWh: Double?,
    @SerializedName("availableBatterySlots") val availableBatterySlots: Int?,
    @SerializedName("distanceKm") val distanceKm: Double?,
    @SerializedName("isOpenNow") val isOpenNow: Boolean?
)

/**
 * Full public detail shown after a marker tap.
 * Mirrors StationDetailResponse in the C# Web API.
 */
data class StationDetailDto(
    @SerializedName("id") val id: String,
    @SerializedName("stationCode") val stationCode: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String?,
    @SerializedName("addressLine") val addressLine: String?,
    @SerializedName("latitude") val latitude: Double?,
    @SerializedName("longitude") val longitude: Double?,
    @SerializedName("capacityKWh") val capacityKWh: Double?,
    @SerializedName("totalBatterySlots") val totalBatterySlots: Int?,
    @SerializedName("availableBatterySlots") val availableBatterySlots: Int?,
    @SerializedName("operationalSchedule") val operationalSchedule: List<ScheduleEntryDto>?,
    @SerializedName("isOpenNow") val isOpenNow: Boolean?,
    @SerializedName("contactPhone") val contactPhone: String?
)

/**
 * One weekly opening window. Verified against ScheduleEntryDto in the C# API:
 * day name "Monday".."Sunday", times as 24-hour "HH:mm".
 */
data class ScheduleEntryDto(
    @SerializedName("dayOfWeek") val dayOfWeek: String?,
    @SerializedName("openTime") val openTime: String?,
    @SerializedName("closeTime") val closeTime: String?,
    /** When true the station is shut all day and the times are ignored. */
    @SerializedName("isClosed") val isClosed: Boolean?
)
