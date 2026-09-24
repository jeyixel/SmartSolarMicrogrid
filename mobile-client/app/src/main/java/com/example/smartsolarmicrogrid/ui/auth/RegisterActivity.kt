package com.example.smartsolarmicrogrid.ui.auth

import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.widget.doAfterTextChanged
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.remote.AuthApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.RegisterProsumerRequestDto
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout

/**
 * Activity handling Prosumer registration.
 *
 * Requirements (Phase 15, Step 2):
 * - Validates NIC, Full Name, Email, Phone, Address, Password, and Confirm Password.
 * - Confirm Password is validated client-side only and excluded from network payload.
 * - Submits to POST /api/auth/register-prosumer.
 * - Displays API success (201 Created with Pending status), validation errors (400),
 *   duplicate conflicts (409), and connectivity failures with retry option.
 */
class RegisterActivity : AppCompatActivity() {

    private lateinit var tilNic: TextInputLayout
    private lateinit var etNic: TextInputEditText

    private lateinit var tilFullName: TextInputLayout
    private lateinit var etFullName: TextInputEditText

    private lateinit var tilEmail: TextInputLayout
    private lateinit var etEmail: TextInputEditText

    private lateinit var tilPhoneNumber: TextInputLayout
    private lateinit var etPhoneNumber: TextInputEditText

    private lateinit var tilAddress: TextInputLayout
    private lateinit var etAddress: TextInputEditText

    private lateinit var tilPassword: TextInputLayout
    private lateinit var etPassword: TextInputEditText

    private lateinit var tilConfirmPassword: TextInputLayout
    private lateinit var etConfirmPassword: TextInputEditText

    private lateinit var btnRegister: MaterialButton
    private lateinit var progressBarRegister: ProgressBar
    private lateinit var tvGoToLogin: TextView

    private val authApiClient = AuthApiClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_register)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.registerScrollRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        initViews()
        setupListeners()
    }

    private fun initViews() {
        tilNic = findViewById(R.id.tilNic)
        etNic = findViewById(R.id.etNic)

        tilFullName = findViewById(R.id.tilFullName)
        etFullName = findViewById(R.id.etFullName)

        tilEmail = findViewById(R.id.tilEmail)
        etEmail = findViewById(R.id.etEmail)

        tilPhoneNumber = findViewById(R.id.tilPhoneNumber)
        etPhoneNumber = findViewById(R.id.etPhoneNumber)

        tilAddress = findViewById(R.id.tilAddress)
        etAddress = findViewById(R.id.etAddress)

        tilPassword = findViewById(R.id.tilPassword)
        etPassword = findViewById(R.id.etPassword)

        tilConfirmPassword = findViewById(R.id.tilConfirmPassword)
        etConfirmPassword = findViewById(R.id.etConfirmPassword)

        btnRegister = findViewById(R.id.btnRegister)
        progressBarRegister = findViewById(R.id.progressBarRegister)
        tvGoToLogin = findViewById(R.id.tvGoToLogin)
    }

    private fun setupListeners() {
        etNic.doAfterTextChanged { tilNic.error = null }
        etFullName.doAfterTextChanged { tilFullName.error = null }
        etEmail.doAfterTextChanged { tilEmail.error = null }
        etPhoneNumber.doAfterTextChanged { tilPhoneNumber.error = null }
        etAddress.doAfterTextChanged { tilAddress.error = null }
        etPassword.doAfterTextChanged { tilPassword.error = null }
        etConfirmPassword.doAfterTextChanged { tilConfirmPassword.error = null }

        btnRegister.setOnClickListener {
            performRegistration()
        }

        tvGoToLogin.setOnClickListener {
            finish()
        }
    }

    private fun performRegistration() {
        val nic = etNic.text?.toString()?.trim().orEmpty()
        val fullName = etFullName.text?.toString()?.trim().orEmpty()
        val email = etEmail.text?.toString()?.trim().orEmpty()
        val phoneNumber = etPhoneNumber.text?.toString()?.trim().orEmpty()
        val address = etAddress.text?.toString()?.trim().orEmpty()
        val password = etPassword.text?.toString().orEmpty()
        val confirmPassword = etConfirmPassword.text?.toString().orEmpty()

        if (!validateInputs(nic, fullName, email, phoneNumber, address, password, confirmPassword)) {
            return
        }

        setLoading(true)

        // confirmPassword is intentionally excluded from the network payload
        val requestDto = RegisterProsumerRequestDto(
            nic = nic,
            fullName = fullName,
            email = email,
            phoneNumber = phoneNumber,
            address = address,
            password = password
        )

        authApiClient.registerProsumer(requestDto) { response ->
            setLoading(false)
            handleRegistrationResponse(response)
        }
    }

    private fun validateInputs(
        nic: String,
        fullName: String,
        email: String,
        phoneNumber: String,
        address: String,
        password: String,
        confirmPassword: String
    ): Boolean {
        var isValid = true

        // 1. NIC validation: 12 digits or 9 digits + V/X
        val nicRegex = Regex("^(?:[0-9]{12}|[0-9]{9}[VvXx])$")
        if (nic.isEmpty()) {
            tilNic.error = getString(R.string.err_nic_required)
            isValid = false
        } else if (!nicRegex.matches(nic)) {
            tilNic.error = getString(R.string.err_nic_format)
            isValid = false
        } else {
            tilNic.error = null
        }

        // 2. Full Name validation: between 2 and 100 chars
        if (fullName.isEmpty()) {
            tilFullName.error = getString(R.string.err_full_name_required)
            isValid = false
        } else if (fullName.length < 2 || fullName.length > 100) {
            tilFullName.error = getString(R.string.err_full_name_length)
            isValid = false
        } else {
            tilFullName.error = null
        }

        // 3. Email validation
        if (email.isEmpty()) {
            tilEmail.error = getString(R.string.err_email_required)
            isValid = false
        } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tilEmail.error = getString(R.string.err_email_invalid)
            isValid = false
        } else {
            tilEmail.error = null
        }

        // 4. Phone Number validation: 10 digits starting with 0
        val phoneRegex = Regex("^0[0-9]{9}$")
        if (phoneNumber.isEmpty()) {
            tilPhoneNumber.error = getString(R.string.err_phone_required)
            isValid = false
        } else if (!phoneRegex.matches(phoneNumber)) {
            tilPhoneNumber.error = getString(R.string.err_phone_format)
            isValid = false
        } else {
            tilPhoneNumber.error = null
        }

        // 5. Address validation: between 5 and 250 chars
        if (address.isEmpty()) {
            tilAddress.error = getString(R.string.err_address_required)
            isValid = false
        } else if (address.length < 5 || address.length > 250) {
            tilAddress.error = getString(R.string.err_address_length)
            isValid = false
        } else {
            tilAddress.error = null
        }

        // 6. Password validation (strict security requirements matching backend)
        if (password.isEmpty()) {
            tilPassword.error = getString(R.string.err_password_required)
            isValid = false
        } else if (password != password.trim()) {
            tilPassword.error = getString(R.string.err_password_whitespace)
            isValid = false
        } else if (password.length < 8 || password.length > 72) {
            tilPassword.error = getString(R.string.err_password_length)
            isValid = false
        } else if (!password.any { it.isUpperCase() }) {
            tilPassword.error = getString(R.string.err_password_uppercase)
            isValid = false
        } else if (!password.any { it.isLowerCase() }) {
            tilPassword.error = getString(R.string.err_password_lowercase)
            isValid = false
        } else if (!password.any { it.isDigit() }) {
            tilPassword.error = getString(R.string.err_password_digit)
            isValid = false
        } else if (!password.any { !it.isLetterOrDigit() }) {
            tilPassword.error = getString(R.string.err_password_special)
            isValid = false
        } else {
            tilPassword.error = null
        }

        // 7. Confirm Password validation
        if (confirmPassword.isEmpty()) {
            tilConfirmPassword.error = getString(R.string.err_confirm_password_required)
            isValid = false
        } else if (confirmPassword != password) {
            tilConfirmPassword.error = getString(R.string.err_confirm_password_mismatch)
            isValid = false
        } else {
            tilConfirmPassword.error = null
        }

        return isValid
    }

    private fun handleRegistrationResponse(response: ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.RegisterProsumerResponseDto>) {
        when (response) {
            is ApiResponse.Success -> {
                val data = response.data
                MaterialAlertDialogBuilder(this)
                    .setTitle(R.string.reg_success_title)
                    .setMessage("${data.message}\n\n${getString(R.string.reg_success_status_pending)}")
                    .setCancelable(false)
                    .setPositiveButton(R.string.reg_go_to_login) { _, _ ->
                        navigateToLogin()
                    }
                    .show()
            }

            is ApiResponse.ValidationError -> {
                val fieldErrors = response.fieldErrors
                if (fieldErrors.isNotEmpty()) {
                    fieldErrors.forEach { (field, message) ->
                        when {
                            field.equals("Nic", ignoreCase = true) -> tilNic.error = message
                            field.equals("FullName", ignoreCase = true) -> tilFullName.error = message
                            field.equals("Email", ignoreCase = true) -> tilEmail.error = message
                            field.equals("PhoneNumber", ignoreCase = true) -> tilPhoneNumber.error = message
                            field.equals("Address", ignoreCase = true) -> tilAddress.error = message
                            field.equals("Password", ignoreCase = true) -> tilPassword.error = message
                            else -> showSnackbar(message)
                        }
                    }
                } else {
                    showSnackbar(response.rawMessage)
                }
            }

            is ApiResponse.Conflict -> {
                // Duplicate NIC or Email - display conflict message without clearing form
                val conflictMessage = response.message
                if (conflictMessage.contains("NIC", ignoreCase = true)) {
                    tilNic.error = conflictMessage
                } else if (conflictMessage.contains("email", ignoreCase = true)) {
                    tilEmail.error = conflictMessage
                }

                MaterialAlertDialogBuilder(this)
                    .setTitle("Account Already Exists")
                    .setMessage(conflictMessage)
                    .setPositiveButton(R.string.dismiss, null)
                    .show()
            }

            is ApiResponse.NetworkFailure -> {
                MaterialAlertDialogBuilder(this)
                    .setTitle(R.string.network_error_title)
                    .setMessage(R.string.network_error_msg)
                    .setPositiveButton(R.string.retry) { _, _ ->
                        performRegistration()
                    }
                    .setNegativeButton(R.string.cancel, null)
                    .show()
            }

            is ApiResponse.ServerError -> {
                MaterialAlertDialogBuilder(this)
                    .setTitle("Registration Failed")
                    .setMessage(response.message)
                    .setPositiveButton(R.string.dismiss, null)
                    .show()
            }
        }
    }

    private fun navigateToLogin() {
        val intent = Intent(this, LoginActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(intent)
        finish()
    }

    private fun setLoading(isLoading: Boolean) {
        btnRegister.isEnabled = !isLoading
        progressBarRegister.visibility = if (isLoading) View.VISIBLE else View.GONE
    }

    private fun showSnackbar(message: String) {
        Snackbar.make(findViewById(R.id.registerContainer), message, Snackbar.LENGTH_LONG).show()
    }
}
