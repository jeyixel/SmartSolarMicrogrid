/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Activity for creating a new energy booking reservation.
 * Guides the prosumer through station selection, slot picker (7-day rule),
 * and energy capacity allocation, delegating all rule enforcement to the C# Web API.
 */
package com.example.smartsolarmicrogrid.ui.booking

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ApiConfig
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.CreateReservationRequestDto
import com.example.smartsolarmicrogrid.data.remote.dto.StationLookupDto
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors

/**
 * Screen enabling prosumers to schedule a new energy slot reservation.
 */
class CreateBookingActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageView
    private lateinit var actvStation: AutoCompleteTextView
    private lateinit var cardSelectSlot: MaterialCardView
    private lateinit var layoutSlotUnselected: LinearLayout
    private lateinit var layoutSlotSelected: LinearLayout
    private lateinit var tvSelectedSlotCode: TextView
    private lateinit var tvSelectedSlotTrade: TextView
    private lateinit var tvSelectedSlotTime: TextView
    private lateinit var tvSelectedSlotBays: TextView
    private lateinit var etKWh: TextInputEditText
    private lateinit var tvProsumerInfo: TextView
    private lateinit var progressBarCreate: ProgressBar
    private lateinit var btnConfirmBooking: MaterialButton

    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager
    private lateinit var reservationApiClient: ReservationApiClient

    private var currentNic: String = ""
    private var currentFullName: String = ""
    private var currentToken: String? = null

    private var availableStations: List<StationLookupDto> = emptyList()
    private var selectedStationId: String = ""
    private var selectedStationName: String = ""

    // Selected slot data from SlotPickerActivity
    private var selectedSlotId: String = ""
    private var selectedSlotCode: String = ""
    private var selectedSlotStart: String = ""
    private var selectedSlotEnd: String = ""
    private var selectedSlotTrade: String = "Charging"
    private var selectedSlotCapacity: Double = 0.0

    private val executor = Executors.newSingleThreadExecutor()

    // Activity result launcher for picking a slot
    private val slotPickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            handleSlotPickerResult(result.data!!)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_create_booking)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.createBookingRoot)) { v, insets ->
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
        loadSessionData()
    }

    private fun initViews() {
        // Initialize view component handles
        btnBack = findViewById(R.id.btnBack)
        actvStation = findViewById(R.id.actvStation)
        cardSelectSlot = findViewById(R.id.cardSelectSlot)
        layoutSlotUnselected = findViewById(R.id.layoutSlotUnselected)
        layoutSlotSelected = findViewById(R.id.layoutSlotSelected)
        tvSelectedSlotCode = findViewById(R.id.tvSelectedSlotCode)
        tvSelectedSlotTrade = findViewById(R.id.tvSelectedSlotTrade)
        tvSelectedSlotTime = findViewById(R.id.tvSelectedSlotTime)
        tvSelectedSlotBays = findViewById(R.id.tvSelectedSlotBays)
        etKWh = findViewById(R.id.etKWh)
        tvProsumerInfo = findViewById(R.id.tvProsumerInfo)
        progressBarCreate = findViewById(R.id.progressBarCreate)
        btnConfirmBooking = findViewById(R.id.btnConfirmBooking)
    }

    private fun setupListeners() {
        // Handle navigation and interaction events
        btnBack.setOnClickListener {
            finish()
        }

        // Open SlotPickerActivity when slot card is clicked
        cardSelectSlot.setOnClickListener {
            if (selectedStationId.isBlank()) {
                Toast.makeText(this, "Please select a solar station first.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val intent = Intent(this, SlotPickerActivity::class.java).apply {
                putExtra(SlotPickerActivity.EXTRA_STATION_ID, selectedStationId)
                putExtra(SlotPickerActivity.EXTRA_STATION_NAME, selectedStationName)
            }
            slotPickerLauncher.launch(intent)
        }

        // Submit reservation creation
        btnConfirmBooking.setOnClickListener {
            submitReservation()
        }
    }

    private fun loadSessionData() {
        // Load active prosumer identity from local SQLite DAO
        executor.execute {
            val session = authSessionDao.readSession()
            val token = tokenManager.getToken()

            runOnUiThread {
                if (session != null) {
                    currentNic = session.nic
                    currentFullName = session.fullName ?: "Prosumer"
                    currentToken = token
                    tvProsumerInfo.text = "NIC: $currentNic • $currentFullName"

                    fetchStations()
                } else {
                    Toast.makeText(this, "Session invalid. Please log in again.", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
        }
    }

    private fun fetchStations() {
        // Load active stations from the backend API for the dropdown selector
        reservationApiClient.getStationLookup(currentToken) { response ->
            when (response) {
                is ApiResponse.Success -> {
                    availableStations = response.data
                    setupStationDropdown(availableStations)
                }
                else -> {
                    // Fallback to sample stations if station lookup is unavailable
                    val fallback = listOf(
                        StationLookupDto("67a000000000000000000001", "CMB-NORTH-01", "Colombo North Solar Hub"),
                        StationLookupDto("67a000000000000000000002", "TNG-SOUTH-02", "Tangalle Solar Hub")
                    )
                    availableStations = fallback
                    setupStationDropdown(fallback)
                }
            }
        }
    }

    private fun setupStationDropdown(stations: List<StationLookupDto>) {
        // Populate exposed dropdown menu with station names
        val stationLabels = stations.map { "${it.name} (${it.stationCode})" }
        val adapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, stationLabels)
        actvStation.setAdapter(adapter)

        actvStation.setOnItemClickListener { _, _, position, _ ->
            val chosen = stations[position]
            selectedStationId = chosen.id
            selectedStationName = chosen.name

            // Reset slot selection whenever station changes
            clearSlotSelection()
        }

        // Auto-select first station if available
        if (stations.isNotEmpty() && selectedStationId.isBlank()) {
            actvStation.setText(stationLabels[0], false)
            selectedStationId = stations[0].id
            selectedStationName = stations[0].name
        }
    }

    private fun handleSlotPickerResult(data: Intent) {
        // Parse selected slot attributes and update card UI
        selectedSlotId = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_ID) ?: ""
        selectedSlotCode = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_CODE) ?: ""
        selectedSlotStart = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_START) ?: ""
        selectedSlotEnd = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_END) ?: ""
        selectedSlotTrade = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_TRADE) ?: "Charging"
        selectedSlotCapacity = data.getDoubleExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_CAPACITY, 0.0)
        val availableBays = data.getIntExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_AVAILABLE_BAYS, 1)

        layoutSlotUnselected.visibility = View.GONE
        layoutSlotSelected.visibility = View.VISIBLE

        tvSelectedSlotCode.text = if (selectedSlotCode.isNotBlank()) selectedSlotCode else "SLOT-${selectedSlotId.takeLast(6).uppercase()}"
        tvSelectedSlotTrade.text = selectedSlotTrade.uppercase(Locale.getDefault())
        tvSelectedSlotTime.text = formatSlotTime(selectedSlotStart, selectedSlotEnd)
        tvSelectedSlotBays.text = "$availableBays bays free • Capacity: ${selectedSlotCapacity} kWh"

        // Default kWh input to 25.0 or capacity if empty
        if (etKWh.text.isNullOrBlank()) {
            val defaultVal = if (selectedSlotCapacity > 0.0) minOf(25.0, selectedSlotCapacity) else 25.0
            etKWh.setText(String.format(Locale.US, "%.1f", defaultVal))
        }
    }

    private fun clearSlotSelection() {
        // Reset selected slot state
        selectedSlotId = ""
        selectedSlotCode = ""
        selectedSlotStart = ""
        selectedSlotEnd = ""
        layoutSlotSelected.visibility = View.GONE
        layoutSlotUnselected.visibility = View.VISIBLE
    }

    private fun submitReservation() {
        // Validate inputs before submitting to Web API
        if (selectedStationId.isBlank()) {
            Toast.makeText(this, "Please select a solar station.", Toast.LENGTH_SHORT).show()
            return
        }

        if (selectedSlotId.isBlank()) {
            Toast.makeText(this, "Please select a booking slot.", Toast.LENGTH_SHORT).show()
            return
        }

        val requestedKWh = etKWh.text?.toString()?.toDoubleOrNull() ?: 0.0
        if (requestedKWh <= 0.0) {
            etKWh.error = "Please enter a valid energy quantity (> 0 kWh)"
            return
        }

        setLoadingState(true)

        val request = CreateReservationRequestDto(
            slotId = selectedSlotId,
            requestedKWh = requestedKWh,
            prosumerNIC = currentNic,
            prosumerName = currentFullName
        )

        reservationApiClient.createReservation(
            request = request,
            userId = currentNic,
            authToken = currentToken
        ) { response ->
            setLoadingState(false)

            when (response) {
                is ApiResponse.Success -> {
                    val created = response.data
                    val timeWindow = formatSlotTime(created.slotStartTime, created.slotEndTime)

                    // Navigate directly to post-action summary confirmation screen
                    val intent = Intent(this, BookingSummaryActivity::class.java).apply {
                        putExtra(BookingSummaryActivity.EXTRA_ACTION_TYPE, BookingSummaryActivity.ACTION_CREATE)
                        putExtra(BookingSummaryActivity.EXTRA_RESERVATION_ID, created.id)
                        putExtra(BookingSummaryActivity.EXTRA_RESERVATION_CODE, created.reservationCode)
                        putExtra(BookingSummaryActivity.EXTRA_STATION_NAME, if (created.stationName.isNotBlank()) created.stationName else selectedStationName)
                        putExtra(BookingSummaryActivity.EXTRA_SLOT_TIME, timeWindow)
                        putExtra(BookingSummaryActivity.EXTRA_ENERGY_KWH, created.requestedKWh)
                        putExtra(BookingSummaryActivity.EXTRA_STATUS, created.status)
                        putExtra(BookingSummaryActivity.EXTRA_PROSUMER_NIC, created.prosumerNIC)
                    }
                    startActivity(intent)
                    finish()
                }
                is ApiResponse.ServerError -> {
                    showErrorDialog(response.message)
                }
                is ApiResponse.NetworkFailure -> {
                    showErrorDialog("Unable to connect to microgrid server. Please check your network connection.")
                }
                else -> {
                    showErrorDialog("Failed to create reservation. Please try again.")
                }
            }
        }
    }

    private fun setLoadingState(loading: Boolean) {
        // Update UI controls during asynchronous network dispatch
        progressBarCreate.visibility = if (loading) View.VISIBLE else View.GONE
        btnConfirmBooking.isEnabled = !loading
        cardSelectSlot.isEnabled = !loading
    }

    private fun showErrorDialog(message: String) {
        // Present API rule violation or network failure dialog
        AlertDialog.Builder(this)
            .setTitle("Reservation Notice")
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun formatSlotTime(startIso: String, endIso: String): String {
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val dateFmt = SimpleDateFormat("dd MMM", Locale.US)
            val timeFmt = SimpleDateFormat("HH:mm", Locale.US)

            val startDate = inputFormat.parse(startIso.substringBefore('.'))
            val endDate = inputFormat.parse(endIso.substringBefore('.'))

            if (startDate != null && endDate != null) {
                "${dateFmt.format(startDate)} • ${timeFmt.format(startDate)} - ${timeFmt.format(endDate)}"
            } else {
                startIso
            }
        } catch (e: Exception) {
            if (startIso.isNotBlank()) startIso else "Scheduled Window"
        }
    }
}
