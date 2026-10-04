/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Activity for modifying an existing energy reservation.
 * Enforces client-side UI affordances for the 12-hour modification rule,
 * and communicates with the central FAT Web API to atomically apply updates.
 */
package com.example.smartsolarmicrogrid.ui.booking

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ApiConfig
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.UpdateReservationRequestDto
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors

/**
 * Screen enabling prosumers to reschedule their booking slot or adjust requested energy capacity.
 */
class EditBookingActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageView
    private lateinit var cardRuleNotice: MaterialCardView
    private lateinit var ivRuleNoticeIcon: ImageView
    private lateinit var tvRuleNoticeText: TextView
    private lateinit var tvEditStationName: TextView
    private lateinit var tvEditStatusPill: TextView
    private lateinit var tvEditCurrentSlot: TextView
    private lateinit var cardChangeSlot: MaterialCardView
    private lateinit var tvSlotSelectionTitle: TextView
    private lateinit var tvSlotSelectionDetails: TextView
    private lateinit var etEditKWh: TextInputEditText
    private lateinit var progressBarEdit: ProgressBar
    private lateinit var btnSaveChanges: MaterialButton

    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager
    private lateinit var reservationApiClient: ReservationApiClient

    private var currentNic: String = ""
    private var currentFullName: String = ""
    private var currentToken: String? = null

    private var reservationId: String = ""
    private var currentSlotId: String = ""
    private var selectedSlotId: String = ""
    private var stationId: String = ""
    private var initialStartTime: String = ""
    private var initialEndTime: String = ""
    private var initialKWh: Double = 0.0
    private var initialStatus: String = "Pending"

    private var selectedSlotDisplayTime: String = ""
    private val executor = Executors.newSingleThreadExecutor()

    // Activity result launcher for rescheduling slot
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
        setContentView(R.layout.activity_edit_booking)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.editBookingRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        readIntentExtras()

        authSessionDao = AuthSessionDao(this)
        tokenManager = TokenManager(this)
        ApiConfig.init(this)
        reservationApiClient = ReservationApiClient(ApiConfig.getBaseUrl())

        initViews()
        setupListeners()
        loadSessionData()
        evaluate12HourRule()
    }

    private fun readIntentExtras() {
        // Read incoming reservation parameters to pre-fill the form
        reservationId = intent.getStringExtra(EXTRA_RESERVATION_ID) ?: ""
        currentSlotId = intent.getStringExtra(EXTRA_CURRENT_SLOT_ID) ?: ""
        selectedSlotId = currentSlotId
        stationId = intent.getStringExtra(EXTRA_STATION_ID) ?: "Station"
        initialStartTime = intent.getStringExtra(EXTRA_START_TIME) ?: ""
        initialEndTime = intent.getStringExtra(EXTRA_END_TIME) ?: ""
        initialKWh = intent.getDoubleExtra(EXTRA_ENERGY_KWH, 0.0)
        initialStatus = intent.getStringExtra(EXTRA_STATUS) ?: "Pending"
    }

    private fun initViews() {
        // Find layout elements
        btnBack = findViewById(R.id.btnBack)
        cardRuleNotice = findViewById(R.id.cardRuleNotice)
        ivRuleNoticeIcon = findViewById(R.id.ivRuleNoticeIcon)
        tvRuleNoticeText = findViewById(R.id.tvRuleNoticeText)
        tvEditStationName = findViewById(R.id.tvEditStationName)
        tvEditStatusPill = findViewById(R.id.tvEditStatusPill)
        tvEditCurrentSlot = findViewById(R.id.tvEditCurrentSlot)
        cardChangeSlot = findViewById(R.id.cardChangeSlot)
        tvSlotSelectionTitle = findViewById(R.id.tvSlotSelectionTitle)
        tvSlotSelectionDetails = findViewById(R.id.tvSlotSelectionDetails)
        etEditKWh = findViewById(R.id.etEditKWh)
        progressBarEdit = findViewById(R.id.progressBarEdit)
        btnSaveChanges = findViewById(R.id.btnSaveChanges)

        tvEditStationName.text = stationId
        tvEditStatusPill.text = "● ${initialStatus.uppercase(Locale.US)}"

        val formattedInitial = formatSlotTime(initialStartTime, initialEndTime)
        tvEditCurrentSlot.text = "Current: $formattedInitial"
        selectedSlotDisplayTime = formattedInitial

        etEditKWh.setText(String.format(Locale.US, "%.1f", initialKWh))
    }

    private fun setupListeners() {
        // Configure click handlers
        btnBack.setOnClickListener {
            finish()
        }

        // Tapping slot card launches SlotPickerActivity to choose another slot
        cardChangeSlot.setOnClickListener {
            val intent = Intent(this, SlotPickerActivity::class.java).apply {
                putExtra(SlotPickerActivity.EXTRA_STATION_ID, stationId)
                putExtra(SlotPickerActivity.EXTRA_STATION_NAME, stationId)
                putExtra(SlotPickerActivity.EXTRA_EXCLUDE_SLOT_ID, currentSlotId)
            }
            slotPickerLauncher.launch(intent)
        }

        btnSaveChanges.setOnClickListener {
            submitUpdate()
        }
    }

    private fun loadSessionData() {
        // Read prosumer identity from local SQLite
        executor.execute {
            val session = authSessionDao.readSession()
            val token = tokenManager.getToken()

            runOnUiThread {
                if (session != null) {
                    currentNic = session.nic
                    currentFullName = session.fullName ?: "Prosumer"
                    currentToken = token
                }
            }
        }
    }

    private fun evaluate12HourRule() {
        // Client-side 12-hour rule evaluation for UX feedback
        val nowMs = System.currentTimeMillis()
        val startMs = parseUtcTimestamp(initialStartTime)
        val hoursUntilStart = (startMs - nowMs) / (1000.0 * 60.0 * 60.0)

        if (hoursUntilStart in 0.0..12.0 || hoursUntilStart < 0.0) {
            // Rule violated: disable form controls with clear visual alert
            btnSaveChanges.isEnabled = false
            cardChangeSlot.isEnabled = false
            etEditKWh.isEnabled = false

            cardRuleNotice.setCardBackgroundColor(ContextCompat.getColor(this, R.color.logout_bg))
            cardRuleNotice.strokeColor = ContextCompat.getColor(this, R.color.logout_border)
            ivRuleNoticeIcon.setImageResource(android.R.drawable.ic_dialog_alert)
            ivRuleNoticeIcon.setColorFilter(ContextCompat.getColor(this, R.color.error_red))
            tvRuleNoticeText.text = "Modifications are locked: Microgrid regulations mandate at least 12 hours prior notice before the scheduled slot."
            tvRuleNoticeText.setTextColor(ContextCompat.getColor(this, R.color.error_red))
        }
    }

    private fun handleSlotPickerResult(data: Intent) {
        // Handle newly chosen slot from SlotPickerActivity
        selectedSlotId = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_ID) ?: currentSlotId
        val slotCode = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_CODE) ?: ""
        val start = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_START) ?: ""
        val end = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_END) ?: ""
        val trade = data.getStringExtra(SlotPickerActivity.EXTRA_SELECTED_SLOT_TRADE) ?: "Charging"

        selectedSlotDisplayTime = formatSlotTime(start, end)
        tvSlotSelectionTitle.text = "Reschedule to: $slotCode"
        tvSlotSelectionDetails.text = "$selectedSlotDisplayTime ($trade)"
    }

    private fun submitUpdate() {
        // Validate inputs and dispatch PUT request to Web API
        val requestedKWh = etEditKWh.text?.toString()?.toDoubleOrNull() ?: 0.0
        if (requestedKWh <= 0.0) {
            etEditKWh.error = "Please enter a valid energy quantity (> 0 kWh)"
            return
        }

        setLoadingState(true)

        val request = UpdateReservationRequestDto(
            slotId = selectedSlotId,
            requestedKWh = requestedKWh,
            prosumerNIC = currentNic,
            prosumerName = currentFullName
        )

        reservationApiClient.updateReservation(
            reservationId = reservationId,
            request = request,
            userId = currentNic,
            authToken = currentToken
        ) { response ->
            when (response) {
                is ApiResponse.Success -> {
                    // PUT returned 204 No Content; query fresh reservation object to show on summary
                    fetchUpdatedReservationAndNavigate(requestedKWh)
                }
                is ApiResponse.ServerError -> {
                    setLoadingState(false)
                    showErrorDialog(response.message)
                }
                is ApiResponse.NetworkFailure -> {
                    setLoadingState(false)
                    showErrorDialog("Unable to connect to microgrid server. Please check your network connection.")
                }
                else -> {
                    setLoadingState(false)
                    showErrorDialog("Failed to update reservation.")
                }
            }
        }
    }

    private fun fetchUpdatedReservationAndNavigate(updatedKWh: Double) {
        // Query updated reservation for complete summary telemetry
        reservationApiClient.getReservationById(reservationId, currentToken) { response ->
            setLoadingState(false)

            val summaryIntent = Intent(this, BookingSummaryActivity::class.java).apply {
                putExtra(BookingSummaryActivity.EXTRA_ACTION_TYPE, BookingSummaryActivity.ACTION_UPDATE)
                putExtra(BookingSummaryActivity.EXTRA_RESERVATION_ID, reservationId)
                putExtra(BookingSummaryActivity.EXTRA_PROSUMER_NIC, currentNic)

                if (response is ApiResponse.Success) {
                    val dto = response.data
                    putExtra(BookingSummaryActivity.EXTRA_RESERVATION_CODE, dto.reservationCode)
                    putExtra(BookingSummaryActivity.EXTRA_STATION_NAME, if (dto.stationName.isNotBlank()) dto.stationName else stationId)
                    putExtra(BookingSummaryActivity.EXTRA_SLOT_TIME, formatSlotTime(dto.slotStartTime, dto.slotEndTime))
                    putExtra(BookingSummaryActivity.EXTRA_ENERGY_KWH, dto.requestedKWh)
                    putExtra(BookingSummaryActivity.EXTRA_STATUS, dto.status)
                } else {
                    putExtra(BookingSummaryActivity.EXTRA_STATION_NAME, stationId)
                    putExtra(BookingSummaryActivity.EXTRA_SLOT_TIME, selectedSlotDisplayTime)
                    putExtra(BookingSummaryActivity.EXTRA_ENERGY_KWH, updatedKWh)
                    putExtra(BookingSummaryActivity.EXTRA_STATUS, initialStatus)
                }
            }

            startActivity(summaryIntent)
            finish()
        }
    }

    private fun setLoadingState(loading: Boolean) {
        // Manage UI control states during async update
        progressBarEdit.visibility = if (loading) View.VISIBLE else View.GONE
        btnSaveChanges.isEnabled = !loading
        cardChangeSlot.isEnabled = !loading
    }

    private fun showErrorDialog(message: String) {
        // Show server validation error dialog
        AlertDialog.Builder(this)
            .setTitle("Modification Notice")
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun parseUtcTimestamp(isoString: String): Long {
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            inputFormat.parse(isoString.substringBefore('.'))?.time ?: 0L
        } catch (e: Exception) {
            0L
        }
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

    companion object {
        const val EXTRA_RESERVATION_ID = "extra_reservation_id"
        const val EXTRA_CURRENT_SLOT_ID = "extra_current_slot_id"
        const val EXTRA_STATION_ID = "extra_station_id"
        const val EXTRA_START_TIME = "extra_start_time"
        const val EXTRA_END_TIME = "extra_end_time"
        const val EXTRA_ENERGY_KWH = "extra_energy_kwh"
        const val EXTRA_ACTION_TYPE = "extra_action_type"
        const val EXTRA_STATUS = "extra_status"
    }
}
