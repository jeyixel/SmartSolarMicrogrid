package com.example.smartsolarmicrogrid.ui.common

import android.app.Activity
import android.content.Intent
import android.widget.Toast
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import com.example.smartsolarmicrogrid.ui.booking.BookingHistoryActivity
import com.example.smartsolarmicrogrid.ui.booking.CreateBookingActivity
import com.example.smartsolarmicrogrid.ui.booking.ReservationQrActivity
import com.example.smartsolarmicrogrid.ui.dashboard.ProsumerDashboardActivity
import com.example.smartsolarmicrogrid.ui.map.NearbyStationsActivity
import com.example.smartsolarmicrogrid.ui.profile.ProfileActivity
import com.google.android.material.bottomnavigation.BottomNavigationView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors

/**
 * Shared navigation for the prosumer bottom bar and quick actions, so every
 * screen opens Bookings and the QR pass the same way.
 */
object ProsumerNavigator {

    private val executor = Executors.newSingleThreadExecutor()

    /**
     * Wires the shared prosumer bottom bar on any screen. [current] is the tab for
     * this screen; it stays highlighted because tapping another tab opens that
     * screen without changing this one's selection.
     */
    fun setupBottomNav(
        activity: Activity,
        bottomNav: BottomNavigationView,
        current: Int,
        onQrSelected: () -> Unit = { openUpcomingQr(activity) }
    ) {
        bottomNav.menu.findItem(current)?.isChecked = true
        bottomNav.setOnItemSelectedListener { item ->
            if (item.itemId == current) return@setOnItemSelectedListener true
            when (item.itemId) {
                R.id.nav_home -> activity.startActivity(
                    Intent(activity, ProsumerDashboardActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                )
                R.id.nav_map -> openTab(activity, NearbyStationsActivity::class.java)
                R.id.nav_bookings -> openBookings(activity)
                R.id.nav_qr -> onQrSelected()
                R.id.nav_profile -> openTab(activity, ProfileActivity::class.java)
            }
            false
        }
    }

    fun openBookings(activity: Activity) = openTab(activity, CreateBookingActivity::class.java)

    /** Brings an already-open tab screen to the front instead of stacking a new copy. */
    private fun openTab(activity: Activity, target: Class<out Activity>) {
        activity.startActivity(Intent(activity, target).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))
    }

    /**
     * Opens the QR pass for [next] when it is approved; otherwise explains why
     * there is no QR yet and falls back to the booking history.
     */
    fun openQrFor(activity: Activity, next: ReservationHistoryDto?) {
        if (next != null && next.status.equals("Approved", true)) {
            activity.startActivity(Intent(activity, ReservationQrActivity::class.java).apply {
                putExtra(ReservationQrActivity.EXTRA_RESERVATION_ID, next.id)
            })
            return
        }
        val message = if (next != null) {
            "Your QR code will be available once the reservation is approved."
        } else {
            "No upcoming reservation. Book a slot to get a QR code."
        }
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        openBookings(activity)
    }

    /** Looks up the user's next reservation from the API, then behaves like [openQrFor]. */
    fun openUpcomingQr(activity: Activity) {
        val sessionDao = AuthSessionDao(activity)
        val tokenManager = TokenManager(activity)
        executor.execute {
            val nic = sessionDao.readSession()?.nic
            val token = tokenManager.getToken()
            activity.runOnUiThread {
                if (nic == null) {
                    openBookings(activity)
                    return@runOnUiThread
                }
                ReservationApiClient().getBookingHistory(nic = nic, authToken = token) { response ->
                    if (activity.isFinishing || activity.isDestroyed) return@getBookingHistory
                    when (response) {
                        is ApiResponse.Success -> openQrFor(activity, findNextReservation(response.data))
                        else -> {
                            Toast.makeText(activity, "Couldn't load your reservations.", Toast.LENGTH_SHORT).show()
                            openBookings(activity)
                        }
                    }
                }
            }
        }
    }

    /** The soonest upcoming Approved or Pending reservation, or null if there is none. */
    fun findNextReservation(items: List<ReservationHistoryDto>): ReservationHistoryDto? {
        val now = System.currentTimeMillis()
        return items
            .filter { it.status.equals("Approved", true) || it.status.equals("Pending", true) }
            .mapNotNull { item -> parseUtc(item.startTime)?.let { item to it } }
            .filter { (_, start) -> start.time >= now }
            .minByOrNull { (_, start) -> start.time }
            ?.first
    }

    /** Parses the backend's UTC ISO-8601 timestamps (with or without fractional seconds / 'Z'). */
    fun parseUtc(iso: String): Date? = try {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.parse(iso.substringBefore('.').removeSuffix("Z"))
    } catch (e: Exception) {
        null
    }
}
