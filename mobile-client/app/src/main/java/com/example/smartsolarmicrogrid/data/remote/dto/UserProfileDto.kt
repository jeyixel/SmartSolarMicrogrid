package com.example.smartsolarmicrogrid.data.remote.dto

import org.json.JSONObject

/**
 * Data transfer object representing the safe Prosumer profile returned by GET /api/prosumer/profile.
 * Excludes sensitive fields (passwords, tokens, internal hashes).
 */
data class UserProfileDto(
    val id: String,
    val nic: String,
    val fullName: String,
    val email: String,
    val phoneNumber: String,
    val address: String,
    val role: String,
    val accountStatus: String,
    val deactivationRequestedAt: String? = null
) {
    val isDeactivationRequested: Boolean
        get() = !deactivationRequestedAt.isNullOrBlank()

    companion object {
        fun fromJson(jsonStr: String): UserProfileDto {
            val json = JSONObject(jsonStr)
            return fromJsonObject(json)
        }

        fun fromJsonObject(json: JSONObject): UserProfileDto {
            // Role and AccountStatus can be integers or strings depending on serialization
            val roleStr = when (val r = json.opt("role")) {
                is Int -> when (r) {
                    0 -> "Backoffice"
                    1 -> "GridOperator"
                    2 -> "Prosumer"
                    else -> "Unknown"
                }
                is String -> r
                else -> "Prosumer"
            }

            val statusStr = when (val s = json.opt("accountStatus")) {
                is Int -> when (s) {
                    0 -> "Pending"
                    1 -> "Active"
                    2 -> "Deactivated"
                    else -> "Unknown"
                }
                is String -> s
                else -> json.optString("status", "Active")
            }

            val deact = if (json.has("deactivationRequestedAt") && !json.isNull("deactivationRequestedAt")) {
                json.optString("deactivationRequestedAt").takeIf { it.isNotBlank() }
            } else {
                null
            }

            return UserProfileDto(
                id = json.optString("id", ""),
                nic = json.optString("nic", json.optString("id", "")),
                fullName = json.optString("fullName", ""),
                email = json.optString("email", ""),
                phoneNumber = json.optString("phoneNumber", ""),
                address = json.optString("address", ""),
                role = roleStr,
                accountStatus = statusStr,
                deactivationRequestedAt = deact
            )
        }
    }
}
