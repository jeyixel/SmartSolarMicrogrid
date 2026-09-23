package com.example.smartsolarmicrogrid.data.local

/**
 * Entity representing the local authentication session row in the SQLite database.
 *
 * @property id The fixed single-row session identifier (always 1).
 * @property nic The National Identity Card number / identifier of the user.
 * @property fullName Cached display name (nullable until full profile is loaded).
 * @property role Exact user role returned by API ("Prosumer", "GridOperator", "Backoffice").
 * @property accountStatus Exact account status returned by API ("Pending", "Active", "Deactivated") (nullable until profile is loaded).
 * @property loggedInAt Epoch millisecond timestamp recording when the login session started.
 */
data class AuthSessionEntity(
    val id: Long = 1L,
    val nic: String,
    val fullName: String? = null,
    val role: String,
    val accountStatus: String? = null,
    val loggedInAt: Long = System.currentTimeMillis()
)
