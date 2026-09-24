package com.example.smartsolarmicrogrid.ui.profile

import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.widget.doAfterTextChanged
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.AuthApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.UpdateUserProfileRequestDto
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.util.concurrent.Executors

/**
 * Activity allowing Prosumers to edit Full Name, Email, Phone Number, and Address.
 * Keeps NIC, Role, and Status read-only.
 * Synchronizes SQLite cached profile upon API success.
 */
class EditProfileActivity : AppCompatActivity() {

    private lateinit var tvReadOnlyNic: TextView
    private lateinit var tvReadOnlyRoleStatus: TextView

    private lateinit var tilEditFullName: TextInputLayout
    private lateinit var etEditFullName: TextInputEditText

    private lateinit var tilEditEmail: TextInputLayout
    private lateinit var etEditEmail: TextInputEditText

    private lateinit var tilEditPhone: TextInputLayout
    private lateinit var etEditPhone: TextInputEditText

    private lateinit var tilEditAddress: TextInputLayout
    private lateinit var etEditAddress: TextInputEditText

    private lateinit var btnSaveProfile: MaterialButton
    private lateinit var progressBarEditProfile: ProgressBar

    private val authApiClient = AuthApiClient()
    private lateinit var tokenManager: TokenManager
    private lateinit var authSessionDao: AuthSessionDao
    private val backgroundExecutor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_edit_profile)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.editProfileScrollRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        tokenManager = TokenManager(this)
        authSessionDao = AuthSessionDao(this)

        initViews()
        prefillData()
        setupListeners()
    }

    private fun initViews() {
        tvReadOnlyNic = findViewById(R.id.tvReadOnlyNic)
        tvReadOnlyRoleStatus = findViewById(R.id.tvReadOnlyRoleStatus)

        tilEditFullName = findViewById(R.id.tilEditFullName)
        etEditFullName = findViewById(R.id.etEditFullName)

        tilEditEmail = findViewById(R.id.tilEditEmail)
        etEditEmail = findViewById(R.id.etEditEmail)

        tilEditPhone = findViewById(R.id.tilEditPhone)
        etEditPhone = findViewById(R.id.etEditPhone)

        tilEditAddress = findViewById(R.id.tilEditAddress)
        etEditAddress = findViewById(R.id.etEditAddress)

        btnSaveProfile = findViewById(R.id.btnSaveProfile)
        progressBarEditProfile = findViewById(R.id.progressBarEditProfile)
    }

    private fun prefillData() {
        val nic = intent.getStringExtra("nic") ?: ""
        val role = intent.getStringExtra("role") ?: "Prosumer"
        val status = intent.getStringExtra("accountStatus") ?: "Active"
        val fullName = intent.getStringExtra("fullName") ?: ""
        val email = intent.getStringExtra("email") ?: ""
        val phone = intent.getStringExtra("phoneNumber") ?: ""
        val address = intent.getStringExtra("address") ?: ""

        tvReadOnlyNic.text = "NIC: $nic (Read-only)"
        tvReadOnlyRoleStatus.text = "Role: $role | Status: $status"

        etEditFullName.setText(fullName)
        etEditEmail.setText(email)
        etEditPhone.setText(phone)
        etEditAddress.setText(address)
    }

    private fun setupListeners() {
        etEditFullName.doAfterTextChanged { tilEditFullName.error = null }
        etEditEmail.doAfterTextChanged { tilEditEmail.error = null }
        etEditPhone.doAfterTextChanged { tilEditPhone.error = null }
        etEditAddress.doAfterTextChanged { tilEditAddress.error = null }

        btnSaveProfile.setOnClickListener {
            performSave()
        }
    }

    private fun performSave() {
        val fullName = etEditFullName.text?.toString()?.trim().orEmpty()
        val email = etEditEmail.text?.toString()?.trim().orEmpty()
        val phone = etEditPhone.text?.toString()?.trim().orEmpty()
        val address = etEditAddress.text?.toString()?.trim().orEmpty()

        if (!validateInputs(fullName, email, phone, address)) {
            return
        }

        val token = tokenManager.getToken()
        if (token.isNullOrBlank()) {
            showSnackbar("Authentication token missing. Please sign in again.")
            return
        }

        setLoading(true)
        val request = UpdateUserProfileRequestDto(
            fullName = fullName,
            email = email,
            phoneNumber = phone,
            address = address
        )

        authApiClient.updateProsumerProfile(token, request) { response ->
            setLoading(false)
            when (response) {
                is ApiResponse.Success -> {
                    val updatedProfile = response.data
                    // Update SQLite user reference upon successful PUT
                    backgroundExecutor.execute {
                        authSessionDao.updateCachedProfile(
                            fullName = updatedProfile.fullName,
                            accountStatus = updatedProfile.accountStatus
                        )
                        runOnUiThread {
                            Toast.makeText(this, "Profile updated successfully", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                    }
                }

                is ApiResponse.Conflict -> {
                    // Duplicate email - keep user edits intact and leave SQLite unchanged
                    tilEditEmail.error = response.message
                    MaterialAlertDialogBuilder(this)
                        .setTitle("Update Conflict")
                        .setMessage(response.message)
                        .setPositiveButton(R.string.dismiss, null)
                        .show()
                }

                is ApiResponse.ValidationError -> {
                    // Field errors - keep edits intact and leave SQLite unchanged
                    val fieldErrors = response.fieldErrors
                    if (fieldErrors.isNotEmpty()) {
                        fieldErrors.forEach { (field, msg) ->
                            when {
                                field.equals("FullName", ignoreCase = true) -> tilEditFullName.error = msg
                                field.equals("Email", ignoreCase = true) -> tilEditEmail.error = msg
                                field.equals("PhoneNumber", ignoreCase = true) -> tilEditPhone.error = msg
                                field.equals("Address", ignoreCase = true) -> tilEditAddress.error = msg
                                else -> showSnackbar(msg)
                            }
                        }
                    } else {
                        showSnackbar(response.rawMessage)
                    }
                }

                is ApiResponse.NetworkFailure -> {
                    MaterialAlertDialogBuilder(this)
                        .setTitle(R.string.network_error_title)
                        .setMessage("Failed to reach server. Would you like to retry?")
                        .setPositiveButton(R.string.retry) { _, _ ->
                            performSave()
                        }
                        .setNegativeButton(R.string.cancel, null)
                        .show()
                }

                is ApiResponse.ServerError -> {
                    showSnackbar("Update failed: ${response.message}")
                }
            }
        }
    }

    private fun validateInputs(fullName: String, email: String, phone: String, address: String): Boolean {
        var isValid = true

        if (fullName.isEmpty()) {
            tilEditFullName.error = getString(R.string.err_full_name_required)
            isValid = false
        } else if (fullName.length < 2 || fullName.length > 100) {
            tilEditFullName.error = getString(R.string.err_full_name_length)
            isValid = false
        } else {
            tilEditFullName.error = null
        }

        if (email.isEmpty()) {
            tilEditEmail.error = getString(R.string.err_email_required)
            isValid = false
        } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tilEditEmail.error = getString(R.string.err_email_invalid)
            isValid = false
        } else {
            tilEditEmail.error = null
        }

        val phoneRegex = Regex("^0[0-9]{9}$")
        if (phone.isEmpty()) {
            tilEditPhone.error = getString(R.string.err_phone_required)
            isValid = false
        } else if (!phoneRegex.matches(phone)) {
            tilEditPhone.error = getString(R.string.err_phone_format)
            isValid = false
        } else {
            tilEditPhone.error = null
        }

        if (address.isEmpty()) {
            tilEditAddress.error = getString(R.string.err_address_required)
            isValid = false
        } else if (address.length < 5 || address.length > 250) {
            tilEditAddress.error = getString(R.string.err_address_length)
            isValid = false
        } else {
            tilEditAddress.error = null
        }

        return isValid
    }

    private fun setLoading(isLoading: Boolean) {
        btnSaveProfile.isEnabled = !isLoading
        progressBarEditProfile.visibility = if (isLoading) View.VISIBLE else View.GONE
    }

    private fun showSnackbar(message: String) {
        Snackbar.make(findViewById(R.id.editProfileContainer), message, Snackbar.LENGTH_LONG).show()
    }
}
