/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Activity allowing prosumers to select an open booking slot at a solar station.
 * Enforces client-side UX filtering for the 7-day scheduling window.
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
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ApiConfig
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.SlotDto
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Slot picker screen allowing selection of an available physical slot.
 */
class SlotPickerActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageView
    private lateinit var btnRefresh: ImageView
    private lateinit var tvStationSubtitle: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var rvSlotPicker: RecyclerView
    private lateinit var layoutEmptyState: LinearLayout

    private lateinit var adapter: SlotPickerAdapter
    private lateinit var reservationApiClient: ReservationApiClient
    private lateinit var tokenManager: TokenManager

    private var stationId: String = ""
    private var stationName: String = ""
    private var excludeSlotId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_slot_picker)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.slotPickerRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        ApiConfig.init(this)
        reservationApiClient = ReservationApiClient(ApiConfig.getBaseUrl())
        tokenManager = TokenManager(this)

        stationId = intent.getStringExtra(EXTRA_STATION_ID) ?: ""
        stationName = intent.getStringExtra(EXTRA_STATION_NAME) ?: "Solar Station"
        excludeSlotId = intent.getStringExtra(EXTRA_EXCLUDE_SLOT_ID) ?: ""

        if (stationId.isBlank()) {
            Toast.makeText(this, "No station specified.", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        initViews()
        setupListeners()
        fetchSlots()
    }

    private fun initViews() {
        // Initialize view references from layout
        btnBack = findViewById(R.id.btnBack)
        btnRefresh = findViewById(R.id.btnRefresh)
        tvStationSubtitle = findViewById(R.id.tvStationSubtitle)
        progressBar = findViewById(R.id.progressBarSlotPicker)
        rvSlotPicker = findViewById(R.id.rvSlotPicker)
        layoutEmptyState = findViewById(R.id.layoutSlotEmptyState)

        tvStationSubtitle.text = "Station: $stationName"

        adapter = SlotPickerAdapter { selectedSlot ->
            onSlotPicked(selectedSlot)
        }
        rvSlotPicker.layoutManager = LinearLayoutManager(this)
        rvSlotPicker.adapter = adapter
    }

    private fun setupListeners() {
        // Attach click handlers for back and refresh actions
        btnBack.setOnClickListener {
            finish()
        }
        btnRefresh.setOnClickListener {
            fetchSlots()
        }
    }

    private fun fetchSlots() {
        // Show loading progress and request open station slots from API
        progressBar.visibility = View.VISIBLE
        layoutEmptyState.visibility = View.GONE

        val token = tokenManager.getToken()
        reservationApiClient.getSlotsByStation(stationId, token) { response ->
            progressBar.visibility = View.GONE
            when (response) {
                is ApiResponse.Success -> {
                    val filteredSlots = filterEligibleSlots(response.data)
                    adapter.updateItems(filteredSlots)
                    layoutEmptyState.visibility = if (filteredSlots.isEmpty()) View.VISIBLE else View.GONE
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

    /**
     * Filters slots based on status == "Open", remaining battery capacity,
     * and the 7-day forward booking rule.
     */
    private fun filterEligibleSlots(slots: List<SlotDto>): List<SlotDto> {
        val now = System.currentTimeMillis()
        val sevenDaysMs = 7L * 24L * 60L * 60L * 1000L
        val maxWindowTime = now + sevenDaysMs

        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        return slots.filter { slot ->
            // Filter out excluded slot if modifying an existing reservation
            if (excludeSlotId.isNotBlank() && slot.id == excludeSlotId) {
                return@filter false
            }

            // Must be open status with available battery capacity
            val isOpen = slot.status.equals("Open", ignoreCase = true)
            val hasCapacity = slot.availableBatterySlots > 0

            // 7-day rule check: slot must start in the future and not more than 7 days ahead
            val slotStartMs = try {
                isoFormat.parse(slot.startTime.substringBefore('.'))?.time ?: 0L
            } catch (e: Exception) {
                0L
            }

            val isIn7DayWindow = slotStartMs > now && slotStartMs <= maxWindowTime

            isOpen && hasCapacity && isIn7DayWindow
        }
    }

    private fun onSlotPicked(slot: SlotDto) {
        // Return selected slot details to caller via Activity Result
        val data = Intent().apply {
            putExtra(EXTRA_SELECTED_SLOT_ID, slot.id)
            putExtra(EXTRA_SELECTED_SLOT_CODE, slot.slotCode)
            putExtra(EXTRA_SELECTED_SLOT_START, slot.startTime)
            putExtra(EXTRA_SELECTED_SLOT_END, slot.endTime)
            putExtra(EXTRA_SELECTED_SLOT_TRADE, slot.tradeType)
            putExtra(EXTRA_SELECTED_SLOT_CAPACITY, slot.totalCapacityKWh)
            putExtra(EXTRA_SELECTED_SLOT_AVAILABLE_BAYS, slot.availableBatterySlots)
        }
        setResult(RESULT_OK, data)
        finish()
    }

    companion object {
        const val EXTRA_STATION_ID = "extra_station_id"
        const val EXTRA_STATION_NAME = "extra_station_name"
        const val EXTRA_EXCLUDE_SLOT_ID = "extra_exclude_slot_id"

        const val EXTRA_SELECTED_SLOT_ID = "extra_selected_slot_id"
        const val EXTRA_SELECTED_SLOT_CODE = "extra_selected_slot_code"
        const val EXTRA_SELECTED_SLOT_START = "extra_selected_slot_start"
        const val EXTRA_SELECTED_SLOT_END = "extra_selected_slot_end"
        const val EXTRA_SELECTED_SLOT_TRADE = "extra_selected_slot_trade"
        const val EXTRA_SELECTED_SLOT_CAPACITY = "extra_selected_slot_capacity"
        const val EXTRA_SELECTED_SLOT_AVAILABLE_BAYS = "extra_selected_slot_available_bays"
    }
}
