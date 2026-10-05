package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Result returned after verifying and completing an energy transfer pass via QR scan.
 */
data class EnergyTransferResultDto(
    val success: Boolean,
    val message: String,
    val reservationId: String,
    val reservationCode: String? = null,
    val prosumerNIC: String,
    val prosumerName: String? = null,
    val stationId: String,
    val stationName: String? = null,
    val transferredKWh: Double,
    val actionType: String,
    val previousStatus: String,
    val newStatus: String,
    val verifiedAtUtc: String
) {
    companion object {
        fun fromJson(json: JSONObject): EnergyTransferResultDto {
            return EnergyTransferResultDto(
                success = json.optBoolean("success", true),
                message = json.optString("message", "Energy transfer completed successfully."),
                reservationId = json.optString("reservationId", ""),
                reservationCode = json.optString("reservationCode", ""),
                prosumerNIC = json.optString("prosumerNIC", ""),
                prosumerName = json.optString("prosumerName", ""),
                stationId = json.optString("stationId", "N/A"),
                stationName = json.optString("stationName", ""),
                transferredKWh = json.optDouble("transferredKWh", 0.0),
                actionType = json.optString("actionType", "Charging"),
                previousStatus = json.optString("previousStatus", "Approved"),
                newStatus = json.optString("newStatus", "Completed"),
                verifiedAtUtc = json.optString("verifiedAtUtc", "")
            )
        }
    }
}
