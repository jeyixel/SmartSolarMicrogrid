/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Full data model representing an EnergyReservation in the Android application.
 * Returned by POST /api/reservations and GET /api/reservations/{id}.
 */
package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Representation of a prosumer reservation returned by the Web API.
 *
 * @property id Unique MongoDB ObjectId of the reservation.
 * @property reservationCode Human-readable reservation code (e.g. RES-20261005-AB12).
 * @property slotId The linked EnergyBookingSlot identifier.
 * @property stationId ID of the station hosting the slot.
 * @property stationName Display name of the solar station.
 * @property slotStartTime Start time of the scheduled slot (ISO 8601 UTC).
 * @property slotEndTime End time of the scheduled slot (ISO 8601 UTC).
 * @property prosumerNIC The National Identity Card number of the prosumer.
 * @property prosumerName Registered name of the prosumer.
 * @property requestedKWh Energy amount requested in kWh.
 * @property status Reservation status (Pending, Approved, CheckedIn, Completed, Cancelled).
 * @property qrCodeToken Security token string for the QR pass (null if not yet generated).
 * @property reservationCreatedAtUtc Creation timestamp.
 * @property lastModifiedAtUtc Last modification timestamp.
 * @property cancelledAtUtc Cancellation timestamp if cancelled.
 */
data class EnergyReservationDto(
    val id: String,
    val reservationCode: String,
    val slotId: String,
    val stationId: String,
    val stationName: String,
    val slotStartTime: String,
    val slotEndTime: String,
    val prosumerNIC: String,
    val prosumerName: String,
    val requestedKWh: Double,
    val status: String,
    val qrCodeToken: String?,
    val reservationCreatedAtUtc: String,
    val lastModifiedAtUtc: String,
    val cancelledAtUtc: String?
) {
    companion object {
        /**
         * Deserializes an EnergyReservationDto from a server response JSONObject.
         */
        fun fromJson(json: JSONObject): EnergyReservationDto {
            // Parse all fields with fallback defaults to ensure stability
            val rawQrToken = json.optString("qrCodeToken", "")
            val rawCancelled = json.optString("cancelledAtUtc", "")

            return EnergyReservationDto(
                id = json.optString("id", ""),
                reservationCode = json.optString("reservationCode", ""),
                slotId = json.optString("slotId", ""),
                stationId = json.optString("stationId", ""),
                stationName = json.optString("stationName", ""),
                slotStartTime = json.optString("slotStartTime", ""),
                slotEndTime = json.optString("slotEndTime", ""),
                prosumerNIC = json.optString("prosumerNIC", ""),
                prosumerName = json.optString("prosumerName", ""),
                requestedKWh = json.optDouble("requestedKWh", 0.0),
                status = json.optString("status", "Pending"),
                qrCodeToken = if (rawQrToken.isNotBlank()) rawQrToken else null,
                reservationCreatedAtUtc = json.optString("reservationCreatedAtUtc", ""),
                lastModifiedAtUtc = json.optString("lastModifiedAtUtc", ""),
                cancelledAtUtc = if (rawCancelled.isNotBlank()) rawCancelled else null
            )
        }
    }
}
