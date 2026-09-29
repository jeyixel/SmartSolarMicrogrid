package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONArray
import org.json.JSONObject

/**
 * Data Transfer Object for prosumer booking history items.
 * Contains detailed information about each reservation and its linked slot.
 */
data class ReservationHistoryDto(
    val id: String,
    val prosumerNIC: String,
    val slotId: String,
    val stationId: String,
    val startTime: String,
    val endTime: String,
    val energyAmountKWh: Double,
    val actionType: String,
    val status: String,
    val qrToken: String?,
    val createdAt: String,
    val updatedAt: String
) {
    companion object {
        fun fromJson(json: JSONObject): ReservationHistoryDto {
            return ReservationHistoryDto(
                id = json.optString("id", ""),
                prosumerNIC = json.optString("prosumerNIC", ""),
                slotId = json.optString("slotId", ""),
                stationId = json.optString("stationId", "N/A"),
                startTime = json.optString("startTime", ""),
                endTime = json.optString("endTime", ""),
                energyAmountKWh = json.optDouble("energyAmountKWh", 0.0),
                actionType = json.optString("actionType", "Drop-off"),
                status = json.optString("status", "Pending"),
                qrToken = if (json.has("qrToken") && !json.isNull("qrToken")) json.optString("qrToken") else null,
                createdAt = json.optString("createdAt", ""),
                updatedAt = json.optString("updatedAt", "")
            )
        }

        fun fromJsonArray(jsonArray: JSONArray): List<ReservationHistoryDto> {
            val list = mutableListOf<ReservationHistoryDto>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.optJSONObject(i)
                if (obj != null) {
                    list.add(fromJson(obj))
                }
            }
            return list
        }
    }
}
