package com.example.smartsolarmicrogrid.ui.booking

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import java.util.Locale
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.ui.common.ProsumerNavigator
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import com.google.android.material.chip.ChipGroup
import java.util.concurrent.Executors

/**
 * Prosumer Booking History and Telemetry Activity.
 * Allows prosumers to query past and active bookings with criteria filtering and search.
 */
class BookingHistoryActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageView
    private lateinit var btnManageReservations: ImageView
    private lateinit var btnRefresh: ImageView
    private lateinit var etSearch: EditText
    private lateinit var btnClearSearch: ImageView
    private lateinit var chipGroupStatus: ChipGroup
    private lateinit var progressBar: ProgressBar
    private lateinit var rvBookingHistory: RecyclerView
    private lateinit var layoutEmptyState: LinearLayout

    private lateinit var adapter: BookingHistoryAdapter
    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager
    private lateinit var reservationApiClient: ReservationApiClient

    private var currentNIC: String = ""
    private var currentToken: String? = null
    private var selectedStatus: String = "All"
    private var currentSearchQuery: String = ""
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_booking_history)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.bookingHistoryRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, 0)
            insets
        }

        // Pass 0 so nav_bookings is not highlighted as current screen on History
        ProsumerNavigator.setupBottomNav(this, findViewById(R.id.bottomNavigation), 0)

        authSessionDao = AuthSessionDao(this)
        tokenManager = TokenManager(this)
        reservationApiClient = ReservationApiClient()

        initViews()
        setupListeners()
        loadSessionAndFetchHistory()
    }

    private fun initViews() {
        btnBack = findViewById(R.id.btnBack)
        btnManageReservations = findViewById(R.id.btnManageReservations)
        btnRefresh = findViewById(R.id.btnRefresh)
        etSearch = findViewById(R.id.etSearch)
        btnClearSearch = findViewById(R.id.btnClearSearch)
        chipGroupStatus = findViewById(R.id.chipGroupStatus)
        progressBar = findViewById(R.id.progressBar)
        rvBookingHistory = findViewById(R.id.rvBookingHistory)
        layoutEmptyState = findViewById(R.id.layoutEmptyState)

        adapter = BookingHistoryAdapter { item ->
            handleHistoryItemClick(item)
        }

        rvBookingHistory.layoutManager = LinearLayoutManager(this)
        rvBookingHistory.adapter = adapter
    }

    private fun setupListeners() {
        btnBack.setOnClickListener {
            finish()
        }

        btnManageReservations.setOnClickListener {
            startActivity(Intent(this, MyReservationsActivity::class.java))
        }

        btnRefresh.setOnClickListener {
            fetchHistory()
        }

        btnClearSearch.setOnClickListener {
            etSearch.text.clear()
        }

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                currentSearchQuery = s?.toString()?.trim() ?: ""
                btnClearSearch.visibility = if (currentSearchQuery.isNotEmpty()) View.VISIBLE else View.GONE
                fetchHistory()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        chipGroupStatus.setOnCheckedStateChangeListener { _, checkedIds ->
            selectedStatus = when {
                checkedIds.contains(R.id.chipPending) -> "Pending"
                checkedIds.contains(R.id.chipApproved) -> "Approved"
                checkedIds.contains(R.id.chipCompleted) -> "Completed"
                checkedIds.contains(R.id.chipCancelled) -> "Cancelled"
                else -> "All"
            }
            fetchHistory()
        }
    }

    private fun loadSessionAndFetchHistory() {
        executor.execute {
            val session = authSessionDao.readSession()
            val token = tokenManager.getToken()
            runOnUiThread {
                if (session != null) {
                    currentNIC = session.nic
                    currentToken = token
                    fetchHistory()
                } else {
                    Toast.makeText(this, "Session expired. Please log in again.", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
        }
    }

    private fun fetchHistory() {
        if (currentNIC.isBlank()) return

        progressBar.visibility = View.VISIBLE
        layoutEmptyState.visibility = View.GONE

        reservationApiClient.getBookingHistory(
            nic = currentNIC,
            status = if (selectedStatus != "All") selectedStatus else null,
            search = if (currentSearchQuery.isNotBlank()) currentSearchQuery else null,
            authToken = currentToken
        ) { response ->
            progressBar.visibility = View.GONE
            when (response) {
                is ApiResponse.Success -> {
                    val data = response.data
                    adapter.updateItems(data)
                    layoutEmptyState.visibility = if (data.isEmpty()) View.VISIBLE else View.GONE
                }
                is ApiResponse.ServerError -> {
                    Toast.makeText(this, response.message, Toast.LENGTH_SHORT).show()
                    layoutEmptyState.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
                }
                is ApiResponse.NetworkFailure -> {
                    Toast.makeText(this, "Network connection error.", Toast.LENGTH_SHORT).show()
                    layoutEmptyState.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
                }
                else -> {}
            }
        }
    }

    private fun handleHistoryItemClick(item: ReservationHistoryDto) {
        val status = item.status.lowercase(Locale.getDefault())
        val shortId = if (item.id.length >= 8) item.id.takeLast(8).uppercase(Locale.getDefault()) else item.id
        val displayName = if (item.stationName.isNotBlank() && item.stationName != "N/A") item.stationName else item.stationId

        val options = mutableListOf<String>()
        if (status == "approved") {
            options.add("View QR Pass")
        }
        if (status == "pending" || status == "approved") {
            options.add("Cancel Reservation")
            options.add("Manage in My Reservations")
        } else {
            options.add("View Details")
        }

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("$displayName (#$shortId)")
            .setItems(options.toTypedArray()) { _, which ->
                when (options[which]) {
                    "View QR Pass" -> {
                        val intent = Intent(this, ReservationQrActivity::class.java).apply {
                            putExtra(ReservationQrActivity.EXTRA_RESERVATION_ID, item.id)
                        }
                        startActivity(intent)
                    }
                    "Cancel Reservation" -> {
                        confirmCancelFromHistory(item)
                    }
                    "Manage in My Reservations" -> {
                        startActivity(Intent(this, MyReservationsActivity::class.java))
                    }
                    "View Details" -> {
                        showDetailsDialog(item)
                    }
                }
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun confirmCancelFromHistory(item: ReservationHistoryDto) {
        val shortId = if (item.id.length >= 8) item.id.takeLast(8).uppercase(Locale.getDefault()) else item.id
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Cancel Reservation")
            .setMessage("Are you sure you want to cancel reservation #$shortId?\n\nThis will release the microgrid slot capacity.")
            .setPositiveButton("Yes, Cancel") { _, _ ->
                progressBar.visibility = View.VISIBLE
                reservationApiClient.cancelReservation(
                    reservationId = item.id,
                    userId = currentNIC,
                    authToken = currentToken
                ) { response ->
                    progressBar.visibility = View.GONE
                    when (response) {
                        is ApiResponse.Success -> {
                            Toast.makeText(this, "Reservation cancelled successfully.", Toast.LENGTH_SHORT).show()
                            fetchHistory()
                            val displayName = if (item.stationName.isNotBlank() && item.stationName != "N/A") item.stationName else item.stationId
                            val intent = Intent(this, BookingSummaryActivity::class.java).apply {
                                putExtra(BookingSummaryActivity.EXTRA_ACTION_TYPE, BookingSummaryActivity.ACTION_CANCEL)
                                putExtra(BookingSummaryActivity.EXTRA_RESERVATION_ID, item.id)
                                putExtra(BookingSummaryActivity.EXTRA_STATION_NAME, displayName)
                                putExtra(BookingSummaryActivity.EXTRA_SLOT_TIME, item.startTime)
                                putExtra(BookingSummaryActivity.EXTRA_ENERGY_KWH, item.energyAmountKWh)
                                putExtra(BookingSummaryActivity.EXTRA_STATUS, "Cancelled")
                                putExtra(BookingSummaryActivity.EXTRA_PROSUMER_NIC, currentNIC)
                            }
                            startActivity(intent)
                        }
                        is ApiResponse.ServerError -> {
                            androidx.appcompat.app.AlertDialog.Builder(this)
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
            .setNegativeButton("Keep Reservation", null)
            .show()
    }

    private fun showDetailsDialog(item: ReservationHistoryDto) {
        val shortId = if (item.id.length >= 8) item.id.takeLast(8).uppercase(Locale.getDefault()) else item.id
        val displayName = if (item.stationName.isNotBlank() && item.stationName != "N/A") item.stationName else item.stationId
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Reservation #$shortId")
            .setMessage("Station: $displayName\nStatus: ${item.status}\nEnergy: ${item.energyAmountKWh} kWh\nAction: ${item.actionType}\nTime: ${item.startTime}")
            .setPositiveButton("OK", null)
            .show()
    }
}
