package com.example.smartsolarmicrogrid

import android.app.Application
import com.example.smartsolarmicrogrid.util.ThemeManager

class SmartSolarApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ThemeManager.applySaved(this)
    }
}
