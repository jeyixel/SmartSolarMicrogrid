package com.example.smartsolarmicrogrid.ui.profile

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.AuthApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.UserProfileDto
import com.example.smartsolarmicrogrid.ui.auth.LoginActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import java.util.concurrent.Executors

/**
 * Activity for displaying prosumer profile details fetched directly from GET /api/prosumer/profile.
 * Never displays passwords, hashes, JWT tokens, or internal audit fields.
 */
class ProfileActivity : AppCompatActivity() {

    private lateinit var tvDisplayFullName: TextView
    private lateinit var tvDisplayNic: TextView
    private lateinit var tvDisplayRole: TextView
    private lateinit var tvDisplayStatus: TextView
    private lateinit var tvDisplayEmail: TextView
    private lateinit var tvDisplayPhone: TextView
    private lateinit var tvDisplayAddress: TextView

    private lateinit var cardDeactivationBanner: MaterialCardView
    private lateinit var btnEditProfile: MaterialButton
    private lateinit var btnRequestDeactivation: MaterialButton
    private lateinit var progressBarProfile: ProgressBar

    private val authApiClient = AuthApiClient()
    private lateinit var tokenManager: TokenManager
    private lateinit var authSessionDao: AuthSessionDao
    private val backgroundExecutor = Executors.newSingleThreadExecutor()

    private var currentProfile: UserProfileDto? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_profile)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.profileScrollRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        tokenManager = TokenManager(this)
        authSessionDao = AuthSessionDao(this)

        initViews()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        loadProfileFromApi()
    }

    private fun initViews() {
        tvDisplayFullName = findViewById(R.id.tvDisplayFullName)
        tvDisplayNic = findViewById(R.id.tvDisplayNic)
        tvDisplayRole = findViewById(R.id.tvDisplayRole)
        tvDisplayStatus = findViewById(R.id.tvDisplayStatus)
        tvDisplayEmail = findViewById(R.id.tvDisplayEmail)
        tvDisplayPhone = findViewById(R.id.tvDisplayPhone)
        tvDisplayAddress = findViewById(R.id.tvDisplayAddress)

        cardDeactivationBanner = findViewById(R.id.cardDeactivationBanner)
        btnEditProfile = findViewById(R.id.btnEditProfile)
        btnRequestDeactivation = findViewById(R.id.btnRequestDeactivation)
        progressBarProfile = findViewById(R.id.progressBarProfile)
    }

    private fun setupListeners() {
        btnEditProfile.setOnClickListener {
            val profile = currentProfile
            if (profile != null) {
                val intent = Intent(this, EditProfileActivity::class.java).apply {
                    putExtra("nic", profile.nic)
                    putExtra("fullName", profile.fullName)
                    putExtra("email", profile.email)
                    putExtra("phoneNumber", profile.phoneNumber)
                    putExtra("address", profile.address)
                    putExtra("role", profile.role)
                    putExtra("accountStatus", profile.accountStatus)
                }
                startActivity(intent)
            } else {
                showSnackbar("Please wait for profile data to load.")
            }
        }

        btnRequestDeactivation.setOnClickListener {
            showDeactivationConfirmationDialog()
        }
    }

    private fun loadProfileFromApi() {
        val token = tokenManager.getToken()
        if (token.isNullOrBlank()) {
            redirectToLogin("Authentication token missing. Please sign in.")
            return
        }

        setLoading(true)
        authApiClient.getProsumerProfile(token) { response ->
            setLoading(false)
            when (response) {
                is ApiResponse.Success -> {
                    val profile = response.data
                    currentProfile = profile
                    bindProfileData(profile)

                    // Sync updated profile to SQLite reference
                    backgroundExecutor.execute {
                        authSessionDao.updateCachedProfile(
                            fullName = profile.fullName,
                            accountStatus = profile.accountStatus
                        )
                    }
                }

                is ApiResponse.ServerError -> {
                    if (response.statusCode == 401 || response.statusCode == 403) {
                        redirectToLogin(response.message)
                    } else {
                        showSnackbar("Error loading profile: ${response.message}")
                    }
                }

                is ApiResponse.NetworkFailure -> {
                    MaterialAlertDialogBuilder(this)
                        .setTitle(R.string.network_error_title)
                        .setMessage("Failed to load profile from server. Would you like to retry?")
                        .setPositiveButton(R.string.retry) { _, _ ->
                            loadProfileFromApi()
                        }
                        .setNegativeButton(R.string.cancel, null)
                        .show()
                }

                else -> {
                    showSnackbar("Failed to load profile.")
                }
            }
        }
    }

    private fun bindProfileData(profile: UserProfileDto) {
        tvDisplayFullName.text = profile.fullName.ifBlank { "Prosumer" }
        tvDisplayNic.text = profile.nic
        tvDisplayRole.text = profile.role
        tvDisplayStatus.text = profile.accountStatus
        tvDisplayEmail.text = profile.email.ifBlank { "None" }
        tvDisplayPhone.text = profile.phoneNumber.ifBlank { "None" }
        tvDisplayAddress.text = profile.address.ifBlank { "None" }

        // Deactivation banner and button state
        if (profile.isDeactivationRequested) {
            cardDeactivationBanner.visibility = View.VISIBLE
            btnRequestDeactivation.isEnabled = false
            btnRequestDeactivation.text = "Deactivation Requested (Pending Review)"
        } else {
            cardDeactivationBanner.visibility = View.GONE
            btnRequestDeactivation.isEnabled = true
            btnRequestDeactivation.text = "Request Account Deactivation"
        }
    }

    private fun showDeactivationConfirmationDialog() {
        val profile = currentProfile ?: return

        MaterialAlertDialogBuilder(this)
            .setTitle("Confirm Deactivation Request")
            .setMessage("Are you sure you want to request deactivation for account ${profile.nic}? Your request will be submitted to Backoffice administration for review. Your account remains active until approved.")
            .setPositiveButton("Submit Request") { _, _ ->
                performDeactivationRequest()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun performDeactivationRequest() {
        val token = tokenManager.getToken() ?: return

        setLoading(true)
        authApiClient.requestDeactivation(token) { response ->
            setLoading(false)
            when (response) {
                is ApiResponse.Success -> {
                    val updatedProfile = response.data
                    currentProfile = updatedProfile
                    bindProfileData(updatedProfile)

                    MaterialAlertDialogBuilder(this)
                        .setTitle("Deactivation Requested")
                        .setMessage("Your request has been submitted. Status: Deactivation requested — awaiting Backoffice review.")
                        .setPositiveButton(R.string.dismiss, null)
                        .show()
                }

                is ApiResponse.Conflict -> {
                    MaterialAlertDialogBuilder(this)
                        .setTitle("Request Notice")
                        .setMessage(response.message)
                        .setPositiveButton(R.string.dismiss, null)
                        .show()
                    loadProfileFromApi()
                }

                is ApiResponse.NetworkFailure -> {
                    MaterialAlertDialogBuilder(this)
                        .setTitle(R.string.network_error_title)
                        .setMessage("Failed to send deactivation request. Please check your connection and retry.")
                        .setPositiveButton(R.string.retry) { _, _ ->
                            performDeactivationRequest()
                        }
                        .setNegativeButton(R.string.cancel, null)
                        .show()
                }

                is ApiResponse.ServerError -> {
                    showSnackbar("Error: ${response.message}")
                }

                else -> {
                    showSnackbar("Deactivation request failed.")
                }
            }
        }
    }

    private fun redirectToLogin(reason: String) {
        backgroundExecutor.execute {
            authSessionDao.deleteSession()
            tokenManager.clearToken()
            runOnUiThread {
                MaterialAlertDialogBuilder(this)
                    .setTitle("Session Expired")
                    .setMessage(reason)
                    .setPositiveButton(R.string.dismiss) { _, _ ->
                        val intent = Intent(this, LoginActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        }
                        startActivity(intent)
                        finish()
                    }
                    .show()
            }
        }
    }

    private fun setLoading(isLoading: Boolean) {
        progressBarProfile.visibility = if (isLoading) View.VISIBLE else View.GONE
        btnEditProfile.isEnabled = !isLoading
    }

    private fun showSnackbar(message: String) {
        Snackbar.make(findViewById(R.id.profileContainer), message, Snackbar.LENGTH_LONG).show()
    }

    companion object {
        private const val TAG = "ProfileActivity"
    }
}
