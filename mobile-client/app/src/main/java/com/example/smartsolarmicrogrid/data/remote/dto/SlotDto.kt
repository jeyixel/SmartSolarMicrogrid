/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Data Transfer Object representing an EnergyBookingSlot at a microgrid station.
 * Maps to backend EnergyBookingSlot model returned by GET /api/slots/by-station/{stationId}.
 */
package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONArray
import org.json.JSONObject

/**
 * Data representation of a physical battery/energy time slot at a microgrid station.
 *
 * @property id Unique MongoDB identifier of the booking slot.
 * @property slotCode System identifier for the slot (e.g. SLOT-20261005-01).
 * @property stationId ID of the parent solar station node.
 * @property stationName Display name of the parent station.
 * @property slotDate Calendar date for the slot in ISO 8601 string format.
 * @property startTime Start timestamp in ISO 8601 UTC string format.
 * @property endTime End timestamp in ISO 8601 UTC string format.
 * @property tradeType Operation type (Charging, Discharging, Drop-off, BatterySwap).
 * @property totalCapacityKWh Total energy capacity offered by the slot.
 * @property totalBatterySlots Total physical bays/slots.
 * @property bookedBatterySlots Count of currently occupied bays.
 * @property availableBatterySlots Remaining unbooked battery bays.
 * @property status Operational state (Open, Full, Closed, Expired).
 */
data class SlotDto(
    val id: String,
    val slotCode: String,
    val stationId: String,
    val stationName: String,
    val slotDate: String,
    val startTime: String,
    val endTime: String,
    val tradeType: String,
    val totalCapacityKWh: Double,
    val totalBatterySlots: Int,
    val bookedBatterySlots: Int,
    val availableBatterySlots: Int,
    val status: String
) {
    companion object {
        /**
         * Deserializes a SlotDto instance from a JSONObject.
         */
        fun fromJson(json: JSONObject): SlotDto {
            // Read properties with robust defaults
            val totalSlots = json.optInt("totalBatterySlots", 0)
            val bookedSlots = json.optInt("bookedBatterySlots", 0)
            val available = json.optInt("availableBatterySlots", totalSlots - bookedSlots)

            return SlotDto(
                id = json.optString("id", ""),
                slotCode = json.optString("slotCode", ""),
                stationId = json.optString("stationId", ""),
                stationName = json.optString("stationName", ""),
                slotDate = json.optString("slotDate", ""),
                startTime = json.optString("startTime", ""),
                endTime = json.optString("endTime", ""),
                tradeType = json.optString("tradeType", "Charging"),
                totalCapacityKWh = json.optDouble("totalCapacityKWh", 0.0),
                totalBatterySlots = totalSlots,
                bookedBatterySlots = bookedSlots,
                availableBatterySlots = available,
                status = json.optString("status", "Open")
            )
        }

        /**
         * Deserializes a list of SlotDto items from a JSONArray.
         */
        fun fromJsonArray(array: JSONArray): List<SlotDto> {
            // Traverse array and map each JSON object to a SlotDto
            val items = ArrayList<SlotDto>(array.length())
            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i)
                if (obj != null) {
                    items.add(fromJson(obj))
                }
            }
            return items
        }
    }
}
