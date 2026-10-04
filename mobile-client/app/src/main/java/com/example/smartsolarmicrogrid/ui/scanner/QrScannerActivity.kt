package com.example.smartsolarmicrogrid.ui.scanner

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
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
import com.example.smartsolarmicrogrid.data.remote.dto.EnergyTransferResultDto
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import com.journeyapps.barcodescanner.DecoratedBarcodeView
import java.util.concurrent.Executors

/**
 * Native Camera QR Scanner and Energy Transfer Verification Activity for Grid Operators.
 * Member 4: Grid Operations, QR & Dashboards.
 */
class QrScannerActivity : AppCompatActivity() {

    private lateinit var barcodeScannerView: DecoratedBarcodeView
    private lateinit var btnBackScanner: ImageView
    private lateinit var btnFlash: ImageView
    private lateinit var btnManualEntry: MaterialButton

    private lateinit var reservationApiClient: ReservationApiClient
    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager

    private var isFlashOn = false
    private var isProcessingScan = false
    private var operatorNic: String = ""
    private val executor = Executors.newSingleThreadExecutor()

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            barcodeScannerView.resume()
        } else {
            Toast.makeText(this, "Camera permission is required to scan QR passes.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_qr_scanner)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.scannerRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        ApiConfig.init(this)
        reservationApiClient = ReservationApiClient(ApiConfig.getBaseUrl())
        authSessionDao = AuthSessionDao(this)
        tokenManager = TokenManager(this)

        initViews()
        setupListeners()
        loadOperatorSession()
        checkCameraPermissionAndStart()
    }

    private fun initViews() {
        barcodeScannerView = findViewById(R.id.barcodeScannerView)
        btnBackScanner = findViewById(R.id.btnBackScanner)
        btnFlash = findViewById(R.id.btnFlash)
        btnManualEntry = findViewById(R.id.btnManualEntry)
    }

    private fun setupListeners() {
        btnBackScanner.setOnClickListener { finish() }

        btnFlash.setOnClickListener {
            toggleFlash()
        }

        btnManualEntry.setOnClickListener {
            showManualTokenDialog()
        }

        barcodeScannerView.decodeContinuous(object : BarcodeCallback {
            override fun barcodeResult(result: BarcodeResult?) {
                if (result == null || isProcessingScan) return
                val token = result.text?.trim() ?: return
                if (token.isNotEmpty()) {
                    isProcessingScan = true
                    barcodeScannerView.pause()
                    handleScannedToken(token)
                }
            }
        })
    }

    private fun toggleFlash() {
        if (isFlashOn) {
            barcodeScannerView.setTorchOff()
            isFlashOn = false
        } else {
            barcodeScannerView.setTorchOn()
            isFlashOn = true
        }
    }

    private fun loadOperatorSession() {
        executor.execute {
            val session = authSessionDao.readSession()
            operatorNic = session?.nic ?: "GridOperator"
        }
    }

    private fun checkCameraPermissionAndStart() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            barcodeScannerView.resume()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun handleScannedToken(token: String) {
        val authToken = tokenManager.getToken()

        reservationApiClient.verifyQrTransfer(token, operatorNic, null, authToken) { response ->
            when (response) {
                is ApiResponse.Success -> {
                    showTransferSuccessDialog(response.data)
                }
                is ApiResponse.ServerError -> {
                    showErrorDialog("Verification Failed", response.message)
                }
                is ApiResponse.Conflict -> {
                    showErrorDialog("Verification Conflict", response.message)
                }
                is ApiResponse.ValidationError -> {
                    showErrorDialog("Validation Error", response.rawMessage)
                }
                is ApiResponse.NetworkFailure -> {
                    showErrorDialog("Network Error", "Unable to connect to the backend server.")
                }
            }
        }
    }

    private fun showManualTokenDialog() {
        val input = EditText(this).apply {
            hint = "e.g. SSM:RES:674A82F1:9B2F3A10"
            setPadding(48, 32, 48, 32)
        }

        MaterialAlertDialogBuilder(this)
            .setTitle("Enter Verification Token")
            .setMessage("Type or paste the prosumer QR code token below:")
            .setView(input)
            .setPositiveButton("Verify & Complete") { _, _ ->
                val token = input.text.toString().trim()
                if (token.isNotEmpty()) {
                    isProcessingScan = true
                    handleScannedToken(token)
                } else {
                    Toast.makeText(this, "Token cannot be empty", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showTransferSuccessDialog(dto: EnergyTransferResultDto) {
        val dialog = BottomSheetDialog(this)
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_transfer_success, null, false)

        val tvSuccessProsumer: TextView = dialogView.findViewById(R.id.tvSuccessProsumer)
        val tvSuccessStation: TextView = dialogView.findViewById(R.id.tvSuccessStation)
        val tvSuccessEnergy: TextView = dialogView.findViewById(R.id.tvSuccessEnergy)
        val tvSuccessStatus: TextView = dialogView.findViewById(R.id.tvSuccessStatus)
        val btnCloseSuccess: MaterialButton = dialogView.findViewById(R.id.btnCloseSuccess)

        val pName = if (!dto.prosumerName.isNullOrBlank()) dto.prosumerName else dto.prosumerNIC
        tvSuccessProsumer.text = "Prosumer: $pName (${dto.prosumerNIC})"
        tvSuccessStation.text = "Station: ${dto.stationName ?: dto.stationId}"
        tvSuccessEnergy.text = "Transferred: ${dto.transferredKWh} kWh (${dto.actionType})"
        tvSuccessStatus.text = "Status: ● COMPLETED"

        btnCloseSuccess.setOnClickListener {
            dialog.dismiss()
            finish()
        }

        dialog.setOnDismissListener {
            isProcessingScan = false
            barcodeScannerView.resume()
        }

        dialog.setContentView(dialogView)
        dialog.show()
    }

    private fun showErrorDialog(title: String, message: String) {
        MaterialAlertDialogBuilder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Scan Again") { _, _ ->
                isProcessingScan = false
                barcodeScannerView.resume()
            }
            .setNegativeButton("Close") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    override fun onResume() {
        super.onResume()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            barcodeScannerView.resume()
        }
    }

    override fun onPause() {
        super.onPause()
        barcodeScannerView.pause()
    }
}
