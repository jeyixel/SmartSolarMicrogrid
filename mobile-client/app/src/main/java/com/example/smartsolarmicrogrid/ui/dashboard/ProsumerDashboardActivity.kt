package com.example.smartsolarmicrogrid.ui.dashboard

import android.content.Intent
import android.os.Bundle
import android.text.format.DateUtils
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import com.example.smartsolarmicrogrid.data.repository.StationRepository
import com.example.smartsolarmicrogrid.ui.auth.LoginActivity
import com.example.smartsolarmicrogrid.ui.booking.BookingHistoryActivity
import com.example.smartsolarmicrogrid.ui.booking.CreateBookingActivity
import com.example.smartsolarmicrogrid.ui.booking.MyReservationsActivity
import com.example.smartsolarmicrogrid.ui.common.ProsumerNavigator
import com.example.smartsolarmicrogrid.ui.map.NearbyStationsActivity
import com.example.smartsolarmicrogrid.ui.profile.ProfileActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.material.bottomnavigation.BottomNavigationView
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Dashboard activity for users with the Active Prosumer role.
 * Integrates live microgrid node operations, nearby station map previews, and live reservation telemetry from the backend Web API.
 */
class ProsumerDashboardActivity : AppCompatActivity() {

    private lateinit var tvAvatarInitials: TextView
    private lateinit var tvGreeting: TextView
    private lateinit var tvWelcomeUser: TextView
    private lateinit var tvUserRoleStatus: TextView
    private lateinit var tvSyncStatus: TextView
    private lateinit var tvPendingCount: TextView
    private lateinit var tvUpcomingApprovedCount: TextView
    private lateinit var tvTotalCount: TextView
    private lateinit var bottomNav: BottomNavigationView

    // Next energy transfer card
    private lateinit var layoutNextTransferContent: View
    private lateinit var layoutNextTransferEmpty: View
    private lateinit var tvNextStatus: TextView
    private lateinit var tvNextStation: TextView
    private lateinit var tvNextSchedule: TextView
    private lateinit var tvNextEnergy: TextView
    private lateinit var tvNextEmptyTitle: TextView
    private lateinit var tvNextEmptySubtitle: TextView

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

    /** The soonest upcoming Approved/Pending reservation, or null if there is none. */
    private var nextReservation: ReservationHistoryDto? = null

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
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        tvGreeting.text = greetingForNow()
        loadSessionData()
    }

    private fun initViews() {
        tvAvatarInitials = findViewById(R.id.tvAvatarInitials)
        tvGreeting = findViewById(R.id.tvGreeting)
        tvWelcomeUser = findViewById(R.id.tvWelcomeUser)
        tvUserRoleStatus = findViewById(R.id.tvUserRoleStatus)
        tvSyncStatus = findViewById(R.id.tvSyncStatus)
        tvPendingCount = findViewById(R.id.tvPendingCount)
        tvUpcomingApprovedCount = findViewById(R.id.tvUpcomingApprovedCount)
        tvTotalCount = findViewById(R.id.tvTotalCount)
        bottomNav = findViewById(R.id.bottomNavigation)

        layoutNextTransferContent = findViewById(R.id.layoutNextTransferContent)
        layoutNextTransferEmpty = findViewById(R.id.layoutNextTransferEmpty)
        tvNextStatus = findViewById(R.id.tvNextStatus)
        tvNextStation = findViewById(R.id.tvNextStation)
        tvNextSchedule = findViewById(R.id.tvNextSchedule)
        tvNextEnergy = findViewById(R.id.tvNextEnergy)
        tvNextEmptyTitle = findViewById(R.id.tvNextEmptyTitle)
        tvNextEmptySubtitle = findViewById(R.id.tvNextEmptySubtitle)

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
                    val displayName = session.fullName?.takeIf { it.isNotBlank() } ?: "Prosumer"
                    tvWelcomeUser.text = displayName.substringBefore(' ')
                    tvAvatarInitials.text = initialsOf(displayName)
                    tvUserRoleStatus.text = "Solar ${session.role}"

                    // Fetch live dashboard statistics from the C# Web API (Member 4)
                    tvSyncStatus.text = "Syncing…"
                    fetchLiveStats(session.nic, token)
                    fetchNextTransfer(session.nic, token)
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
                    tvTotalCount.text = response.data.totalBookingsCount.toString()
                    val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
                    setSyncStatus("● Updated $time", R.color.color_on_brand_accent)
                }
                else -> {
                    // Retain the last known counts and flag that the data may be stale
                    setSyncStatus("● Offline", R.color.color_on_brand_warning)
                }
            }
        }
    }

    private fun setSyncStatus(text: String, colorRes: Int) {
        tvSyncStatus.text = text
        tvSyncStatus.setTextColor(ContextCompat.getColor(this, colorRes))
    }

    /** Loads booking history and shows the soonest upcoming Approved or Pending reservation. */
    private fun fetchNextTransfer(nic: String, token: String?) {
        reservationApiClient.getBookingHistory(nic = nic, authToken = token) { response ->
            when (response) {
                is ApiResponse.Success -> {
                    nextReservation = ProsumerNavigator.findNextReservation(response.data)
                    renderNextTransfer(loadFailed = false)
                }
                else -> {
                    nextReservation = null
                    renderNextTransfer(loadFailed = true)
                }
            }
        }
    }

    private fun renderNextTransfer(loadFailed: Boolean) {
        val next = nextReservation
        if (next == null) {
            layoutNextTransferContent.visibility = View.GONE
            layoutNextTransferEmpty.visibility = View.VISIBLE
            if (loadFailed) {
                tvNextEmptyTitle.text = "Couldn't load reservations"
                tvNextEmptySubtitle.text = "Check your connection and reopen the dashboard."
            } else {
                tvNextEmptyTitle.text = "No upcoming transfers"
                tvNextEmptySubtitle.text = "Find a nearby station and reserve a slot."
            }
            return
        }

        layoutNextTransferEmpty.visibility = View.GONE
        layoutNextTransferContent.visibility = View.VISIBLE

        val approved = next.status.equals("Approved", true)
        tvNextStatus.text = next.status.uppercase(Locale.getDefault())
        tvNextStatus.setBackgroundResource(if (approved) R.drawable.bg_pill_active else R.drawable.bg_pill_review)
        tvNextStatus.setTextColor(
            ContextCompat.getColor(this, if (approved) R.color.color_on_primary_container else R.color.color_on_warning_container)
        )

        tvNextStation.text = next.stationName.ifBlank { next.stationId }
        tvNextSchedule.text = formatSchedule(next.startTime, next.endTime)
        tvNextEnergy.text = String.format(Locale.getDefault(), "%.1f kWh • %s", next.energyAmountKWh, next.actionType)
    }

    private fun openNextReservationQr() = ProsumerNavigator.openQrFor(this, nextReservation)

    private fun setupListeners() {
        // QR uses the reservation this screen already loaded, so it opens instantly
        ProsumerNavigator.setupBottomNav(this, bottomNav, R.id.nav_home) { openNextReservationQr() }

        // Quick Actions logic mapping (Member 2 map logic & navigation)
        val openStations = View.OnClickListener {
            startActivity(Intent(this, NearbyStationsActivity::class.java))
        }
        findViewById<View>(R.id.btnQuickNearby).setOnClickListener(openStations)
        findViewById<View>(R.id.tvSeeMap).setOnClickListener(openStations)
        findViewById<View>(R.id.cardMapPlaceholder).setOnClickListener(openStations)

        // Member 3 - Book Energy quick action
        val openBooking = View.OnClickListener {
            startActivity(Intent(this, CreateBookingActivity::class.java))
        }
        findViewById<View>(R.id.btnQuickBook).setOnClickListener(openBooking)
        findViewById<View>(R.id.btnBookFromEmpty).setOnClickListener(openBooking)

        // Member 3 - My Reservations management screen (Modify, Cancel, QR & History)
        findViewById<View>(R.id.btnQuickBookings).setOnClickListener {
            startActivity(Intent(this, MyReservationsActivity::class.java))
        }
        findViewById<View>(R.id.btnQuickQr).setOnClickListener { openNextReservationQr() }
        findViewById<View>(R.id.cardNextTransfer).setOnClickListener {
            if (nextReservation != null) openNextReservationQr()
        }

        findViewById<View>(R.id.btnNotifications).setOnClickListener {
            Toast.makeText(this, "No new notifications", Toast.LENGTH_SHORT).show()
        }
    }

    private fun greetingForNow(): String = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11 -> "Good morning,"
        in 12..16 -> "Good afternoon,"
        else -> "Good evening,"
    }

    private fun initialsOf(name: String): String =
        name.split(' ').filter { it.isNotBlank() }.take(2)
            .joinToString("") { it.first().uppercase() }
            .ifEmpty { "P" }

    /** e.g. "Today • 10:30 – 11:30", "Tomorrow • 09:00 – 10:00", "Mon, 12 Oct • 14:00 – 15:00". */
    private fun formatSchedule(startIso: String, endIso: String): String {
        val start = ProsumerNavigator.parseUtc(startIso) ?: return startIso
        val end = ProsumerNavigator.parseUtc(endIso)
        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

        val day = when {
            DateUtils.isToday(start.time) -> "Today"
            DateUtils.isToday(start.time - DateUtils.DAY_IN_MILLIS) -> "Tomorrow"
            else -> SimpleDateFormat("EEE, d MMM", Locale.getDefault()).format(start)
        }
        val range = if (end != null) "${timeFormat.format(start)} – ${timeFormat.format(end)}" else timeFormat.format(start)
        return "$day • $range"
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