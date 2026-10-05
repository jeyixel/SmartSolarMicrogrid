package com.example.smartsolarmicrogrid.data.local

import android.content.Context
import android.content.SharedPreferences

/**
 * Manages persistent storage of the JWT authentication token separately from the SQLite profile row.
 */
class TokenManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
    }

    fun getToken(): String? {
        return prefs.getString(KEY_AUTH_TOKEN, null)
    }

    fun clearToken() {
        prefs.edit().remove(KEY_AUTH_TOKEN).apply()
    }

    fun hasToken(): Boolean {
        return !getToken().isNullOrBlank()
    }

    companion object {
        private const val PREFS_NAME = "smart_solar_auth_prefs"
        private const val KEY_AUTH_TOKEN = "jwt_bearer_token"
    }
}
