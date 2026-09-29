package com.example.smartsolarmicrogrid.ui.dashboard

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.repository.StationRepository
import com.example.smartsolarmicrogrid.ui.auth.LoginActivity
import com.example.smartsolarmicrogrid.ui.map.NearbyStationsActivity
import com.example.smartsolarmicrogrid.ui.profile.ProfileActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.button.MaterialButton
import java.util.concurrent.Executors

/**
 * Dashboard activity for users with the Active Prosumer role.
 */
class ProsumerDashboardActivity : AppCompatActivity() {

    private lateinit var tvWelcomeUser: TextView
    private lateinit var tvUserRoleStatus: TextView
    private lateinit var bottomNav: BottomNavigationView
    
    // Live Preview Fields
    private lateinit var cardPreviewStation: View
    private lateinit var tvPreviewStationName: TextView
    private lateinit var tvPreviewStationStatus: TextView
    private lateinit var tvPreviewStationDetails: TextView
    
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var stationRepository: StationRepository

    private lateinit var authSessionDao: AuthSessionDao
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_prosumer_dashboard)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.prosumerDashboardRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        authSessionDao = AuthSessionDao(this)

        initViews()
        loadSessionData()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        bottomNav.selectedItemId = R.id.nav_home
        loadSessionData()
    }

    private fun initViews() {
        tvWelcomeUser = findViewById(R.id.tvWelcomeUser)
        tvUserRoleStatus = findViewById(R.id.tvUserRoleStatus)
        bottomNav = findViewById(R.id.bottomNavigation)
        
        // Quick Actions logic mapping (Member 2 map logic)
        findViewById<View>(R.id.btnQuickNearby)?.setOnClickListener {
            startActivity(Intent(this, NearbyStationsActivity::class.java))
        }
    }

    private fun loadSessionData() {
        executor.execute {
            val session = authSessionDao.readSession()
            runOnUiThread {
                if (session != null) {
                    val displayName = session.fullName ?: "Prosumer"
                    tvWelcomeUser.text = displayName
                    tvUserRoleStatus.text = "Solar ${session.role} • Microgrid Node #04"
                }
            }
        }
    }

    private fun setupListeners() {
        bottomNav.selectedItemId = R.id.nav_home
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> true
                R.id.nav_map -> {
                    startActivity(Intent(this, NearbyStationsActivity::class.java))
                    true
                }
                R.id.nav_profile -> {
                    startActivity(Intent(this, ProfileActivity::class.java))
                    true
                }
                else -> false
            }
        }
        
        // Wire up buttons from the new UI layout
        findViewById<android.view.View>(R.id.btnQuickNearby).setOnClickListener {
            startActivity(Intent(this, NearbyStationsActivity::class.java))
        }
    }

    private fun performLogout() {
        executor.execute {
            authSessionDao.deleteSession()
            TokenManager(this).clearToken()
            runOnUiThread {
                val intent = Intent(this, LoginActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                startActivity(intent)
                finish()
            }
        }
    }
}
