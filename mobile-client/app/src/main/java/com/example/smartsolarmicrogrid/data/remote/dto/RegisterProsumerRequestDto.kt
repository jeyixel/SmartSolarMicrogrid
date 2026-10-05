package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Request payload for prosumer self-registration matching backend RegisterProsumerRequest DTO.
 * Excludes confirmPassword (which is verified strictly on the Android client).
 */
data class RegisterProsumerRequestDto(
    val nic: String,
    val fullName: String,
    val email: String,
    val phoneNumber: String,
    val address: String,
    val password: String
) {
    fun toJson(): String {
        return JSONObject().apply {
            put("nic", nic)
            put("fullName", fullName)
            put("email", email)
            put("phoneNumber", phoneNumber)
            put("address", address)
            put("password", password)
        }.toString()
    }
}
