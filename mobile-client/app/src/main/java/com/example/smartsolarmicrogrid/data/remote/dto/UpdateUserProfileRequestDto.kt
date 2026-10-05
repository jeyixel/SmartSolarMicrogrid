package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Request payload for updating editable profile fields via PUT /api/prosumer/profile.
 */
data class UpdateUserProfileRequestDto(
    val fullName: String,
    val email: String,
    val phoneNumber: String,
    val address: String
) {
    fun toJson(): String {
        return JSONObject().apply {
            put("fullName", fullName)
            put("email", email)
            put("phoneNumber", phoneNumber)
            put("address", address)
        }.toString()
    }
}
