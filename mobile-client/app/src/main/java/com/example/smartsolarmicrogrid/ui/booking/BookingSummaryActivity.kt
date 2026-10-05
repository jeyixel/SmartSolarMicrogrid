/**
 * Smart Solar Microgrid Trading System
 * Member 3: Reservation Workflow & Validation
 *
 * Post-action summary confirmation activity.
 * Displayed after creating, updating, or cancelling an energy reservation.
 * Fulfills the project requirement: "immediate rendering of a summary page after any reservation action."
 */
package com.example.smartsolarmicrogrid.ui.booking

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.ui.dashboard.ProsumerDashboardActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import java.util.Locale

/**
 * Reusable summary screen for energy booking actions (Create, Update, Cancel).
 */
class BookingSummaryActivity : AppCompatActivity() {

    private lateinit var btnClose: ImageView
    private lateinit var cardStatusHeader: MaterialCardView
    private lateinit var ivActionStatusIcon: ImageView
    private lateinit var tvActionTitle: TextView
    private lateinit var tvActionSubtitle: TextView
    private lateinit var tvSummaryStatusBadge: TextView
    private lateinit var tvSummaryRefCode: TextView
    private lateinit var tvSummaryStation: TextView
    private lateinit var tvSummarySlotTime: TextView
    private lateinit var tvSummaryEnergy: TextView
    private lateinit var tvSummaryNic: TextView
    private lateinit var btnViewQrPass: MaterialButton
    private lateinit var btnViewMyReservations: MaterialButton
    private lateinit var btnDone: MaterialButton

    private var actionType: String = ACTION_CREATE
    private var reservationId: String = ""
    private var reservationCode: String = ""
    private var stationName: String = ""
    private var slotTime: String = ""
    private var energyKWh: Double = 0.0
    private var status: String = "Pending"
    private var prosumerNic: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_booking_summary)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.summaryRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        readIntentExtras()
        initViews()
        setupListeners()
        bindSummaryData()
    }

    private fun readIntentExtras() {
        // Read action type and reservation parameters from Intent extras
        actionType = intent.getStringExtra(EXTRA_ACTION_TYPE) ?: ACTION_CREATE
        reservationId = intent.getStringExtra(EXTRA_RESERVATION_ID) ?: ""
        reservationCode = intent.getStringExtra(EXTRA_RESERVATION_CODE) ?: ""
        stationName = intent.getStringExtra(EXTRA_STATION_NAME) ?: "Solar Hub"
        slotTime = intent.getStringExtra(EXTRA_SLOT_TIME) ?: "Scheduled Window"
        energyKWh = intent.getDoubleExtra(EXTRA_ENERGY_KWH, 0.0)
        status = intent.getStringExtra(EXTRA_STATUS) ?: "Pending"
        prosumerNic = intent.getStringExtra(EXTRA_PROSUMER_NIC) ?: ""
    }

    private fun initViews() {
        // Locate views in the layout hierarchy
        btnClose = findViewById(R.id.btnClose)
        cardStatusHeader = findViewById(R.id.cardStatusHeader)
        ivActionStatusIcon = findViewById(R.id.ivActionStatusIcon)
        tvActionTitle = findViewById(R.id.tvActionTitle)
        tvActionSubtitle = findViewById(R.id.tvActionSubtitle)
        tvSummaryStatusBadge = findViewById(R.id.tvSummaryStatusBadge)
        tvSummaryRefCode = findViewById(R.id.tvSummaryRefCode)
        tvSummaryStation = findViewById(R.id.tvSummaryStation)
        tvSummarySlotTime = findViewById(R.id.tvSummarySlotTime)
        tvSummaryEnergy = findViewById(R.id.tvSummaryEnergy)
        tvSummaryNic = findViewById(R.id.tvSummaryNic)
        btnViewQrPass = findViewById(R.id.btnViewQrPass)
        btnViewMyReservations = findViewById(R.id.btnViewMyReservations)
        btnDone = findViewById(R.id.btnDone)
    }

    private fun setupListeners() {
        // Close / Done returns to Prosumer Dashboard
        btnClose.setOnClickListener {
            navigateToDashboard()
        }
        btnDone.setOnClickListener {
            navigateToDashboard()
        }

        // Navigate to My Reservations management screen
        btnViewMyReservations.setOnClickListener {
            val intent = Intent(this, MyReservationsActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
            finish()
        }

        // Member 4 hand-off: Open QR activity with reservation ID
        btnViewQrPass.setOnClickListener {
            if (reservationId.isNotBlank()) {
                val intent = Intent(this, ReservationQrActivity::class.java).apply {
                    putExtra(ReservationQrActivity.EXTRA_RESERVATION_ID, reservationId)
                }
                startActivity(intent)
            }
        }
    }

    private fun bindSummaryData() {
        // Bind reservation attributes
        tvSummaryRefCode.text = if (reservationCode.isNotBlank()) reservationCode else "RES-#${reservationId.takeLast(6).uppercase()}"
        tvSummaryStation.text = stationName
        tvSummarySlotTime.text = slotTime
        tvSummaryEnergy.text = String.format(Locale.US, "%.1f kWh", energyKWh)
        tvSummaryNic.text = if (prosumerNic.isNotBlank()) prosumerNic else "Registered Prosumer"

        // Customize header text, colors, and QR button visibility by action type
        when (actionType) {
            ACTION_UPDATE -> {
                tvActionTitle.text = "Reservation Updated!"
                tvActionSubtitle.text = "Your booking modifications have been successfully saved."
                cardStatusHeader.setCardBackgroundColor(ContextCompat.getColor(this, R.color.solar_green_secondary))
                ivActionStatusIcon.setImageResource(android.R.drawable.checkbox_on_background)
                btnViewQrPass.visibility = View.VISIBLE
            }
            ACTION_CANCEL -> {
                tvActionTitle.text = "Reservation Cancelled"
                tvActionSubtitle.text = "The reservation was cancelled and slot capacity released."
                cardStatusHeader.setCardBackgroundColor(ContextCompat.getColor(this, R.color.text_secondary))
                ivActionStatusIcon.setImageResource(android.R.drawable.ic_delete)
                btnViewQrPass.visibility = View.GONE
            }
            else -> { // ACTION_CREATE
                tvActionTitle.text = "Reservation Confirmed!"
                tvActionSubtitle.text = "Your energy trading slot has been scheduled."
                cardStatusHeader.setCardBackgroundColor(ContextCompat.getColor(this, R.color.solar_green_primary))
                ivActionStatusIcon.setImageResource(android.R.drawable.checkbox_on_background)
                btnViewQrPass.visibility = View.VISIBLE
            }
        }

        // Status badge formatting
        val formattedStatus = status.uppercase(Locale.US)
        tvSummaryStatusBadge.text = "● $formattedStatus"
        when (formattedStatus) {
            "APPROVED", "CONFIRMED" -> {
                tvSummaryStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.solar_green_light))
            }
            "CANCELLED", "REJECTED" -> {
                tvSummaryStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.white))
            }
            else -> { // PENDING
                tvSummaryStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.solar_amber))
            }
        }

        // Only Approved / Confirmed bookings may view/generate the QR pass
        if (actionType == ACTION_CANCEL || formattedStatus == "CANCELLED" || formattedStatus == "REJECTED" || formattedStatus == "PENDING") {
            btnViewQrPass.visibility = View.GONE
        } else {
            btnViewQrPass.visibility = View.VISIBLE
        }
    }

    private fun navigateToDashboard() {
        // Return cleanly to ProsumerDashboardActivity
        val intent = Intent(this, ProsumerDashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(intent)
        finish()
    }

    companion object {
        const val EXTRA_ACTION_TYPE = "extra_action_type"
        const val EXTRA_RESERVATION_ID = "extra_reservation_id"
        const val EXTRA_RESERVATION_CODE = "extra_reservation_code"
        const val EXTRA_STATION_NAME = "extra_station_name"
        const val EXTRA_SLOT_TIME = "extra_slot_time"
        const val EXTRA_ENERGY_KWH = "extra_energy_kwh"
        const val EXTRA_STATUS = "extra_status"
        const val EXTRA_PROSUMER_NIC = "extra_prosumer_nic"

        const val ACTION_CREATE = "CREATE"
        const val ACTION_UPDATE = "UPDATE"
        const val ACTION_CANCEL = "CANCEL"
    }
}
