/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Prosumer Energy Reservation Management Activity.
 * Displays active reservations with controls to Modify, Cancel, or View QR passes.
 * Interfaces seamlessly with Member 4's BookingHistoryActivity and ReservationQrActivity.
 */
package com.example.smartsolarmicrogrid.ui.booking

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ApiConfig
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import com.google.android.material.button.MaterialButton
import java.util.concurrent.Executors

/**
 * Screen providing prosumers with direct controls to manage, update, and cancel their energy bookings.
 */
class MyReservationsActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageView
    private lateinit var tvFullHistoryLink: TextView
    private lateinit var btnHeaderNewBooking: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var rvMyReservations: RecyclerView
    private lateinit var layoutEmptyReservations: LinearLayout
    private lateinit var btnEmptyBookEnergy: MaterialButton

    private lateinit var adapter: MyReservationsAdapter
    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager
    private lateinit var reservationApiClient: ReservationApiClient

    private var currentNic: String = ""
    private var currentToken: String? = null
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_my_reservations)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.myReservationsRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        authSessionDao = AuthSessionDao(this)
        tokenManager = TokenManager(this)
        ApiConfig.init(this)
        reservationApiClient = ReservationApiClient(ApiConfig.getBaseUrl())

        initViews()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        // Reload reservation data on screen resumption to reflect recent edits or additions
        loadSessionAndFetchReservations()
    }

    private fun initViews() {
        // Initialize layout references
        btnBack = findViewById(R.id.btnBack)
        tvFullHistoryLink = findViewById(R.id.tvFullHistoryLink)
        btnHeaderNewBooking = findViewById(R.id.btnHeaderNewBooking)
        progressBar = findViewById(R.id.progressBarMyReservations)
        rvMyReservations = findViewById(R.id.rvMyReservations)
        layoutEmptyReservations = findViewById(R.id.layoutEmptyReservations)
        btnEmptyBookEnergy = findViewById(R.id.btnEmptyBookEnergy)

        adapter = MyReservationsAdapter(
            items = emptyList(),
            onModifyClick = { item -> handleModifyReservation(item) },
            onCancelClick = { item -> confirmCancelReservation(item) },
            onViewQrClick = { item -> handleViewQr(item) }
        )

        rvMyReservations.layoutManager = LinearLayoutManager(this)
        rvMyReservations.adapter = adapter
    }

    private fun setupListeners() {
        // Back navigation
        btnBack.setOnClickListener {
            finish()
        }

        // Member 4 hand-off: Open full booking history with filters and telemetry
        tvFullHistoryLink.setOnClickListener {
            val intent = Intent(this, BookingHistoryActivity::class.java)
            startActivity(intent)
        }

        // Open Create Booking screen
        btnHeaderNewBooking.setOnClickListener {
            startActivity(Intent(this, CreateBookingActivity::class.java))
        }

        btnEmptyBookEnergy.setOnClickListener {
            startActivity(Intent(this, CreateBookingActivity::class.java))
        }
    }

    private fun loadSessionAndFetchReservations() {
        // Query local SQLite session to identify the current prosumer
        executor.execute {
            val session = authSessionDao.readSession()
            val token = tokenManager.getToken()

            runOnUiThread {
                if (session != null) {
                    currentNic = session.nic
                    currentToken = token
                    fetchReservations()
                } else {
                    Toast.makeText(this, "Session expired. Please log in again.", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
        }
    }

    private fun fetchReservations() {
        // Fetch reservations for the active prosumer from the Web API
        if (currentNic.isBlank()) return

        progressBar.visibility = View.VISIBLE
        layoutEmptyReservations.visibility = View.GONE

        reservationApiClient.getBookingHistory(
            nic = currentNic,
            authToken = currentToken
        ) { response ->
            progressBar.visibility = View.GONE

            when (response) {
                is ApiResponse.Success -> {
                    val data = response.data
                    adapter.updateItems(data)
                    layoutEmptyReservations.visibility = if (data.isEmpty()) View.VISIBLE else View.GONE
                }
                is ApiResponse.ServerError -> {
                    Toast.makeText(this, response.message, Toast.LENGTH_SHORT).show()
                    layoutEmptyReservations.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
                }
                is ApiResponse.NetworkFailure -> {
                    Toast.makeText(this, "Unable to load reservations. Please check network.", Toast.LENGTH_SHORT).show()
                    layoutEmptyReservations.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
                }
                else -> {}
            }
        }
    }

    private fun handleModifyReservation(item: ReservationHistoryDto) {
        // Launch EditBookingActivity passing reservation identifiers
        val displayName = if (item.stationName.isNotBlank() && item.stationName != "N/A") item.stationName else item.stationId
        val intent = Intent(this, EditBookingActivity::class.java).apply {
            putExtra(EditBookingActivity.EXTRA_RESERVATION_ID, item.id)
            putExtra(EditBookingActivity.EXTRA_CURRENT_SLOT_ID, item.slotId)
            putExtra(EditBookingActivity.EXTRA_STATION_ID, item.stationId)
            putExtra(EditBookingActivity.EXTRA_STATION_NAME, displayName)
            putExtra(EditBookingActivity.EXTRA_START_TIME, item.startTime)
            putExtra(EditBookingActivity.EXTRA_END_TIME, item.endTime)
            putExtra(EditBookingActivity.EXTRA_ENERGY_KWH, item.energyAmountKWh)
            putExtra(EditBookingActivity.EXTRA_ACTION_TYPE, item.actionType)
            putExtra(EditBookingActivity.EXTRA_STATUS, item.status)
        }
        startActivity(intent)
    }

    private fun confirmCancelReservation(item: ReservationHistoryDto) {
        // Show confirmation dialog before releasing slot capacity
        val shortId = if (item.id.length >= 8) item.id.takeLast(8).uppercase() else item.id

        AlertDialog.Builder(this)
            .setTitle("Cancel Reservation")
            .setMessage("Are you sure you want to cancel reservation #$shortId?\n\nThis will immediately release the microgrid slot capacity.")
            .setPositiveButton("Yes, Cancel") { _, _ ->
                performCancellation(item)
            }
            .setNegativeButton("Keep Reservation", null)
            .show()
    }

    private fun performCancellation(item: ReservationHistoryDto) {
        // Submit cancellation to Web API
        progressBar.visibility = View.VISIBLE

        reservationApiClient.cancelReservation(
            reservationId = item.id,
            userId = currentNic,
            authToken = currentToken
        ) { response ->
            progressBar.visibility = View.GONE

            when (response) {
                is ApiResponse.Success -> {
                    Toast.makeText(this, "Reservation cancelled successfully.", Toast.LENGTH_SHORT).show()

                    val displayName = if (item.stationName.isNotBlank() && item.stationName != "N/A") item.stationName else item.stationId
                    // Navigate immediately to post-action summary confirmation screen
                    val intent = Intent(this, BookingSummaryActivity::class.java).apply {
                        putExtra(BookingSummaryActivity.EXTRA_ACTION_TYPE, BookingSummaryActivity.ACTION_CANCEL)
                        putExtra(BookingSummaryActivity.EXTRA_RESERVATION_ID, item.id)
                        putExtra(BookingSummaryActivity.EXTRA_STATION_NAME, displayName)
                        putExtra(BookingSummaryActivity.EXTRA_SLOT_TIME, item.startTime)
                        putExtra(BookingSummaryActivity.EXTRA_ENERGY_KWH, item.energyAmountKWh)
                        putExtra(BookingSummaryActivity.EXTRA_STATUS, "Cancelled")
                        putExtra(BookingSummaryActivity.EXTRA_PROSUMER_NIC, currentNic)
                    }
                    startActivity(intent)
                }
                is ApiResponse.ServerError -> {
                    AlertDialog.Builder(this)
                        .setTitle("Cancellation Failed")
                        .setMessage(response.message)
                        .setPositiveButton("OK", null)
                        .show()
                }
                is ApiResponse.NetworkFailure -> {
                    Toast.makeText(this, "Network connection error.", Toast.LENGTH_SHORT).show()
                }
                else -> {
                    Toast.makeText(this, "Unable to cancel reservation.", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun handleViewQr(item: ReservationHistoryDto) {
        // Member 4 hand-off: Open ReservationQrActivity with EXTRA_RESERVATION_ID
        val intent = Intent(this, ReservationQrActivity::class.java).apply {
            putExtra(ReservationQrActivity.EXTRA_RESERVATION_ID, item.id)
        }
        startActivity(intent)
    }
}
