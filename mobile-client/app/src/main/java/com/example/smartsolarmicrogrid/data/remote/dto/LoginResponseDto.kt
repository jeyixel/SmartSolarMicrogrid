package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * User profile object within the login response.
 */
data class AuthenticatedUserDto(
    val id: String,
    val fullName: String,
    val nic: String,
    val role: String,
    val status: String
) {
    companion object {
        fun fromJson(json: JSONObject): AuthenticatedUserDto {
            return AuthenticatedUserDto(
                id = json.optString("id", ""),
                fullName = json.optString("fullName", ""),
                nic = json.optString("nic", ""),
                role = json.optString("role", ""),
                status = json.optString("status", "")
            )
        }
    }
}

/**
 * Successful response from POST /api/auth/login containing JWT, expiration, and user summary.
 */
data class LoginResponseDto(
    val token: String,
    val expiresAt: String,
    val user: AuthenticatedUserDto
) {
    companion object {
        fun fromJson(jsonStr: String): LoginResponseDto {
            val json = JSONObject(jsonStr)
            val userObj = json.optJSONObject("user") ?: JSONObject()
            return LoginResponseDto(
                token = json.optString("token", ""),
                expiresAt = json.optString("expiresAt", ""),
                user = AuthenticatedUserDto.fromJson(userObj)
            )
        }
    }
}
