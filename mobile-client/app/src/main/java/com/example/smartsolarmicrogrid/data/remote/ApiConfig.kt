package com.example.smartsolarmicrogrid.data.remote

import android.content.Context
import com.example.smartsolarmicrogrid.BuildConfig

/**
 * Centralized API network configuration for Smart Solar Microgrid.
 *
 * Networking Environments:
 * - AVD_KESTREL (Default for local testing):
 *     Connects Android Virtual Device (AVD) to the dotnet Kestrel backend (port 5127).
 *     10.0.2.2 is the emulator's alias for the host PC's 127.0.0.1.
 *
 * - AVD_IIS (For presentation on AVD):
 *     Connects Android Virtual Device (AVD) to the Windows IIS server on host PC (port 8080).
 *
 * - PHYSICAL_IIS (For presentation on physical Android device):
 *     Connects a physical Android phone over the local Wi-Fi to Windows IIS (port 8080).
 */
object ApiConfig {
    const val PREFS_NAME = "smart_solar_api_config"
    const val KEY_BASE_URL = "custom_base_url"

    // Preset base URLs
    const val URL_AVD_KESTREL = "http://10.0.2.2:5127/"
    const val URL_AVD_IIS = "http://10.0.2.2:8080/"
    const val URL_PHYSICAL_IIS = "http://192.168.8.101:8080/"

    // In-memory cache, defaults to BuildConfig.API_BASE_URL
    @Volatile
    private var activeBaseUrl: String = BuildConfig.API_BASE_URL

    /**
     * Initializes the API configuration from SharedPreferences if previously set.
     */
    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        activeBaseUrl = prefs.getString(KEY_BASE_URL, BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL
    }

    /**
     * Returns the active base URL, ensuring it ends with a trailing slash.
     */
    fun getBaseUrl(): String {
        return if (activeBaseUrl.endsWith("/")) activeBaseUrl else "$activeBaseUrl/"
    }

    /**
     * Updates and persists the active base URL.
     */
    fun setBaseUrl(context: Context, newUrl: String) {
        var formatted = newUrl.trim()
        if (!formatted.endsWith("/")) {
            formatted += "/"
        }
        activeBaseUrl = formatted
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_BASE_URL, formatted).apply()
    }
}
