package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Request DTO for authenticating against POST /api/auth/login.
 */
data class LoginRequestDto(
    val identifier: String,
    val password: String
) {
    fun toJson(): String {
        return JSONObject().apply {
            put("identifier", identifier)
            put("password", password)
        }.toString()
    }
}
