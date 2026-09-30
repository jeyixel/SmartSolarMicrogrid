package com.example.smartsolarmicrogrid.ui.booking

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ApiConfig
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.QrCodeDetailsDto
import com.example.smartsolarmicrogrid.util.QrBitmapGenerator
import com.google.android.material.button.MaterialButton
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Activity for displaying the dynamic digital QR code pass for a confirmed energy reservation.
 * Member 4: Grid Operations & QR Code Operations.
 */
class ReservationQrActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageView
    private lateinit var tvStationName: TextView
    private lateinit var tvStationCode: TextView
    private lateinit var ivQrCode: ImageView
    private lateinit var progressBarQr: ProgressBar
    private lateinit var tvQrToken: TextView
    private lateinit var tvStatusBadge: TextView
    private lateinit var tvSlotTime: TextView
    private lateinit var tvEnergyAmount: TextView
    private lateinit var btnDone: MaterialButton

    private lateinit var reservationApiClient: ReservationApiClient
    private lateinit var tokenManager: TokenManager
    private var reservationId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_reservation_qr)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.qrRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        ApiConfig.init(this)
        reservationApiClient = ReservationApiClient(ApiConfig.getBaseUrl())
        tokenManager = TokenManager(this)

        reservationId = intent.getStringExtra(EXTRA_RESERVATION_ID) ?: ""
        if (reservationId.isBlank()) {
            Toast.makeText(this, "Invalid reservation record", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        initViews()
        setupListeners()
        loadQrPass()
    }

    private fun initViews() {
        btnBack = findViewById(R.id.btnBack)
        tvStationName = findViewById(R.id.tvStationName)
        tvStationCode = findViewById(R.id.tvStationCode)
        ivQrCode = findViewById(R.id.ivQrCode)
        progressBarQr = findViewById(R.id.progressBarQr)
        tvQrToken = findViewById(R.id.tvQrToken)
        tvStatusBadge = findViewById(R.id.tvStatusBadge)
        tvSlotTime = findViewById(R.id.tvSlotTime)
        tvEnergyAmount = findViewById(R.id.tvEnergyAmount)
        btnDone = findViewById(R.id.btnDone)
    }

    private fun setupListeners() {
        btnBack.setOnClickListener { finish() }
        btnDone.setOnClickListener { finish() }
    }

    private fun loadQrPass() {
        progressBarQr.visibility = View.VISIBLE
        ivQrCode.visibility = View.INVISIBLE

        val token = tokenManager.getToken()
        reservationApiClient.generateQrCode(reservationId, token) { response ->
            progressBarQr.visibility = View.GONE

            when (response) {
                is ApiResponse.Success -> {
                    bindQrData(response.data)
                }
                is ApiResponse.ServerError -> {
                    Toast.makeText(this, response.message, Toast.LENGTH_LONG).show()
                    Log.e(TAG, "Server error generating QR pass: ${response.message}")
                }
                is ApiResponse.Conflict -> {
                    Toast.makeText(this, response.message, Toast.LENGTH_LONG).show()
                    Log.e(TAG, "Conflict generating QR pass: ${response.message}")
                }
                is ApiResponse.ValidationError -> {
                    Toast.makeText(this, response.rawMessage, Toast.LENGTH_LONG).show()
                    Log.e(TAG, "Validation error generating QR pass: ${response.rawMessage}")
                }
                is ApiResponse.NetworkFailure -> {
                    Toast.makeText(this, "Network error. Please check your connection.", Toast.LENGTH_LONG).show()
                    Log.e(TAG, "Network error generating QR pass", response.exception)
                }
            }
        }
    }

    private fun bindQrData(dto: QrCodeDetailsDto) {
        val sName = if (!dto.stationName.isNullOrBlank()) dto.stationName else dto.stationId
        tvStationName.text = sName
        tvStationCode.text = "Station: ${dto.stationId}"
        tvQrToken.text = dto.qrCodeToken
        tvEnergyAmount.text = "${dto.requestedKWh} kWh"
        tvSlotTime.text = formatTimeRange(dto.slotStartTime, dto.slotEndTime)

        val statusText = dto.status.uppercase(Locale.US)
        tvStatusBadge.text = "● $statusText — READY TO SCAN"

        // Generate QR Code bitmap from token
        val qrBitmap = QrBitmapGenerator.generateQrBitmap(dto.qrCodeToken, 512)
        if (qrBitmap != null) {
            ivQrCode.setImageBitmap(qrBitmap)
            ivQrCode.visibility = View.VISIBLE
        } else {
            Toast.makeText(this, "Failed to render QR Code bitmap", Toast.LENGTH_SHORT).show()
        }
    }

    private fun formatTimeRange(startStr: String, endStr: String): String {
        return try {
            val zdtStart = ZonedDateTime.parse(startStr)
            val zdtEnd = ZonedDateTime.parse(endStr)
            val dayFormatter = DateTimeFormatter.ofPattern("dd MMM", Locale.US)
            val timeFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
            "${zdtStart.format(dayFormatter)} • ${zdtStart.format(timeFormatter)} - ${zdtEnd.format(timeFormatter)}"
        } catch (e: Exception) {
            if (startStr.isNotBlank()) startStr else "Scheduled Slot"
        }
    }

    companion object {
        private const val TAG = "ReservationQrActivity"
        const val EXTRA_RESERVATION_ID = "extra_reservation_id"
    }
}
