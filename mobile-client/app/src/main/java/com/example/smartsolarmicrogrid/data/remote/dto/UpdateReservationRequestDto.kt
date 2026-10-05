/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Request payload DTO for modifying an existing energy booking reservation.
 * Sent in the request body of PUT /api/reservations/{id}.
 */
package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Payload data for updating a prosumer energy reservation.
 *
 * @property slotId The MongoDB identifier of the target (existing or newly selected) EnergyBookingSlot.
 * @property requestedKWh The revised amount of energy (kWh) requested by the prosumer.
 * @property prosumerNIC The National Identity Card number of the prosumer.
 * @property prosumerName The registered full name of the prosumer.
 */
data class UpdateReservationRequestDto(
    val slotId: String,
    val requestedKWh: Double,
    val prosumerNIC: String,
    val prosumerName: String
) {
    /**
     * Serializes this request DTO into a JSON object for HTTP transmission.
     */
    fun toJson(): JSONObject {
        // Construct JSON object with required modification fields
        return JSONObject().apply {
            put("slotId", slotId)
            put("requestedKWh", requestedKWh)
            put("prosumerNIC", prosumerNIC)
            put("prosumerName", prosumerName)
        }
    }
}
