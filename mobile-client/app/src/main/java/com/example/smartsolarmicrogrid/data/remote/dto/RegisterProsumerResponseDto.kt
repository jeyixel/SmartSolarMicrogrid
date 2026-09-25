package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Response payload returned on 201 Created from POST /api/auth/register-prosumer.
 */
data class RegisterProsumerResponseDto(
    val userId: String,
    val message: String,
    val accountStatus: String
) {
    companion object {
        fun fromJson(jsonStr: String): RegisterProsumerResponseDto {
            val json = JSONObject(jsonStr)
            return RegisterProsumerResponseDto(
                userId = json.optString("userId", ""),
                message = json.optString("message", ""),
                accountStatus = json.optString("accountStatus", "Pending")
            )
        }
    }
}
