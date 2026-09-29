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
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.repository.StationRepository
import com.example.smartsolarmicrogrid.ui.auth.LoginActivity
import com.example.smartsolarmicrogrid.ui.booking.BookingHistoryActivity
import com.example.smartsolarmicrogrid.ui.map.NearbyStationsActivity
import com.example.smartsolarmicrogrid.ui.profile.ProfileActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.material.bottomnavigation.BottomNavigationView
import java.util.concurrent.Executors

/**
 * Dashboard activity for users with the Active Prosumer role.
 * Integrates live microgrid node operations, nearby station map previews, and live reservation telemetry from the backend Web API.
 */
class ProsumerDashboardActivity : AppCompatActivity() {

    private lateinit var tvWelcomeUser: TextView
    private lateinit var tvUserRoleStatus: TextView
    private lateinit var tvPendingCount: TextView
    private lateinit var tvUpcomingApprovedCount: TextView
    private lateinit var bottomNav: BottomNavigationView

    // Live Preview Fields (Member 2 map logic)
    private lateinit var cardPreviewStation: View
    private lateinit var tvPreviewStationName: TextView
    private lateinit var tvPreviewStationStatus: TextView
    private lateinit var tvPreviewStationDetails: TextView

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var stationRepository: StationRepository

    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager
    private lateinit var reservationApiClient: ReservationApiClient
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_prosumer_dashboard)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.prosumerDashboardRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, 0)
            insets
        }

        authSessionDao = AuthSessionDao(this)
        tokenManager = TokenManager(this)
        reservationApiClient = ReservationApiClient()

        initViews()
        loadSessionData()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        if (::bottomNav.isInitialized) {
            bottomNav.selectedItemId = R.id.nav_home
        }
        loadSessionData()
    }

    private fun initViews() {
        tvWelcomeUser = findViewById(R.id.tvWelcomeUser)
        tvUserRoleStatus = findViewById(R.id.tvUserRoleStatus)
        tvPendingCount = findViewById(R.id.tvPendingCount)
        tvUpcomingApprovedCount = findViewById(R.id.tvUpcomingApprovedCount)
        bottomNav = findViewById(R.id.bottomNavigation)

        cardPreviewStation = findViewById(R.id.cardPreviewStation)
        tvPreviewStationName = findViewById(R.id.tvPreviewStationName)
        tvPreviewStationStatus = findViewById(R.id.tvPreviewStationStatus)
        tvPreviewStationDetails = findViewById(R.id.tvPreviewStationDetails)
    }

    private fun loadSessionData() {
        executor.execute {
            val session = authSessionDao.readSession()
            val token = tokenManager.getToken()
            runOnUiThread {
                if (session != null) {
                    val displayName = session.fullName ?: "Prosumer"
                    tvWelcomeUser.text = displayName
                    tvUserRoleStatus.text = "Solar ${session.role} • Microgrid Node #04"

                    // Fetch live dashboard statistics from the C# Web API (Member 4)
                    fetchLiveStats(session.nic, token)
                }
            }
        }
    }

    private fun fetchLiveStats(nic: String, token: String?) {
        reservationApiClient.getDashboardStats(nic, token) { response ->
            when (response) {
                is ApiResponse.Success -> {
                    tvPendingCount.text = response.data.pendingCount.toString()
                    tvUpcomingApprovedCount.text = response.data.upcomingApprovedCount.toString()
                }
                else -> {
                    // Gracefully retain default counts if offline
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

        // Quick Actions logic mapping (Member 2 map logic & navigation)
        findViewById<View>(R.id.btnQuickNearby)?.setOnClickListener {
            startActivity(Intent(this, NearbyStationsActivity::class.java))
        }

        findViewById<View>(R.id.tvSeeMap)?.setOnClickListener {
            startActivity(Intent(this, NearbyStationsActivity::class.java))
        }

        findViewById<View>(R.id.cardMapPlaceholder)?.setOnClickListener {
            startActivity(Intent(this, NearbyStationsActivity::class.java))
        }

        // Member 4 - My Bookings quick action
        findViewById<View>(R.id.btnQuickBookings)?.setOnClickListener {
            startActivity(Intent(this, BookingHistoryActivity::class.java))
        }
    }

    private fun performLogout() {
        executor.execute {
            authSessionDao.deleteSession()
            tokenManager.clearToken()
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
