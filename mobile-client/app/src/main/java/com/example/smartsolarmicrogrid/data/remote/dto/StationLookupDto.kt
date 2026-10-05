/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Data Transfer Object representing active solar stations for dropdown selectors.
 * Maps to backend StationLookupResponse (GET /api/stations/lookup).
 */
package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONArray
import org.json.JSONObject

/**
 * Lightweight station identity model for station selection dropdowns and pickers.
 *
 * @property id Unique MongoDB identifier of the solar station node.
 * @property stationCode Unique human-readable station code (e.g. CMB-NORTH-01).
 * @property name Descriptive display name of the solar microgrid station.
 */
data class StationLookupDto(
    val id: String,
    val stationCode: String,
    val name: String
) {
    companion object {
        /**
         * Parses a single StationLookupDto from a JSONObject response payload.
         */
        fun fromJson(json: JSONObject): StationLookupDto {
            // Extract identifier and metadata fields with fallback defaults
            return StationLookupDto(
                id = json.optString("id", ""),
                stationCode = json.optString("stationCode", ""),
                name = json.optString("name", "")
            )
        }

        /**
         * Parses a list of StationLookupDto items from a JSONArray.
         */
        fun fromJsonArray(array: JSONArray): List<StationLookupDto> {
            // Iterate through JSON array elements and deserialize each station entry
            val items = ArrayList<StationLookupDto>(array.length())
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
