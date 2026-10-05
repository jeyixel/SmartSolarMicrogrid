/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Request payload DTO for creating a new energy booking reservation.
 * Sent in the request body of POST /api/reservations.
 */
package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Payload data for creating a new prosumer energy reservation.
 *
 * @property slotId The MongoDB identifier of the target EnergyBookingSlot.
 * @property requestedKWh The amount of energy (kWh) requested by the prosumer.
 * @property prosumerNIC The National Identity Card number of the prosumer.
 * @property prosumerName The registered full name of the prosumer.
 */
data class CreateReservationRequestDto(
    val slotId: String,
    val requestedKWh: Double,
    val prosumerNIC: String,
    val prosumerName: String
) {
    /**
     * Serializes this request DTO into a JSON object for HTTP transmission.
     */
    fun toJson(): JSONObject {
        // Build JSON object matching backend EnergyReservation binding expectations
        return JSONObject().apply {
            put("slotId", slotId)
            put("requestedKWh", requestedKWh)
            put("prosumerNIC", prosumerNIC)
            put("prosumerName", prosumerName)
        }
    }
}
