package com.example.smartsolarmicrogrid.util

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate

/**
 * Stores and applies the user's appearance choice (System / Light / Dark).
 * The colors themselves live in res/values/colors.xml and res/values-night/colors.xml.
 */
object ThemeManager {

    enum class Mode(val label: String, val nightMode: Int) {
        SYSTEM("System default", AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM),
        LIGHT("Light", AppCompatDelegate.MODE_NIGHT_NO),
        DARK("Dark", AppCompatDelegate.MODE_NIGHT_YES)
    }

    private const val PREFS_NAME = "smart_solar_appearance"
    private const val KEY_MODE = "theme_mode"

    fun getMode(context: Context): Mode {
        val saved = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_MODE, Mode.SYSTEM.name)
        return Mode.entries.firstOrNull { it.name == saved } ?: Mode.SYSTEM
    }

    /** Saves [mode] and recreates open activities with the new theme. */
    fun setMode(context: Context, mode: Mode) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_MODE, mode.name).apply()
        AppCompatDelegate.setDefaultNightMode(mode.nightMode)
    }

    /** Call once at app start, before any activity is shown. */
    fun applySaved(context: Context) {
        AppCompatDelegate.setDefaultNightMode(getMode(context).nightMode)
    }
}
