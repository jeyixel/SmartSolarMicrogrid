package com.example.smartsolarmicrogrid.ui.auth

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
import androidx.core.widget.doAfterTextChanged
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.AuthSessionEntity
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.AuthApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.AuthenticatedUserDto
import com.example.smartsolarmicrogrid.data.remote.dto.LoginRequestDto
import com.example.smartsolarmicrogrid.data.remote.dto.LoginResponseDto
import com.example.smartsolarmicrogrid.ui.dashboard.GridOperatorDashboardActivity
import com.example.smartsolarmicrogrid.ui.dashboard.ProsumerDashboardActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.util.concurrent.Executors

/**
 * Entry-point Login activity for the Smart Solar Microgrid mobile application.
 *
 * Startup & Remembered Login Handshake:
 * 1. Read local cached row with readSessionResult().
 * 2. Retrieve the auth token from TokenManager.
 * 3. Call GET /api/auth/me to confirm token validity, role, and active status.
 * 4. On 200 OK Active: update cached profile in SQLite, route to role dashboard, clear Login from back stack.
 * 5. On 401/403 (expired/invalid token or pending/deactivated): clear SQLite session & token, show Login.
 * 6. On Network failure: prompt with retry option (do not delete cached session).
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var tilIdentifier: TextInputLayout
    private lateinit var etIdentifier: TextInputEditText
    private lateinit var tilPassword: TextInputLayout
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnLogin: MaterialButton
    private lateinit var progressBarLogin: ProgressBar
    private lateinit var tvGoToRegister: TextView

    private val authApiClient = AuthApiClient()
    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager
    private val backgroundExecutor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_login)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.loginScrollRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        authSessionDao = AuthSessionDao(this)
        tokenManager = TokenManager(this)

        initViews()
        setupListeners()

        // Verify remembered session on startup
        verifyRememberedSessionOnStartup()
    }

    private fun initViews() {
        tilIdentifier = findViewById(R.id.tilIdentifier)
        etIdentifier = findViewById(R.id.etIdentifier)
        tilPassword = findViewById(R.id.tilPassword)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        progressBarLogin = findViewById(R.id.progressBarLogin)
        tvGoToRegister = findViewById(R.id.tvGoToRegister)
    }

    private fun setupListeners() {
        etIdentifier.doAfterTextChanged {
            tilIdentifier.error = null
        }

        etPassword.doAfterTextChanged {
            tilPassword.error = null
        }

        btnLogin.setOnClickListener {
            Log.d(TAG, "Login button clicked")
            performLogin()
        }

        tvGoToRegister.setOnClickListener {
            val intent = Intent(this, RegisterActivity::class.java)
            startActivity(intent)
        }
    }

    private fun verifyRememberedSessionOnStartup() {
        backgroundExecutor.execute {
            val sessionResult = authSessionDao.readSessionResult()
            val cachedSession = sessionResult.getOrNull()
            val savedToken = tokenManager.getToken()

            if (cachedSession != null && !savedToken.isNullOrBlank()) {
                Log.d(TAG, "Found cached session for ${cachedSession.nic} and token. Verifying via GET /api/auth/me...")
                runOnUiThread {
                    setLoading(true)
                }

                authApiClient.getCurrentUser(savedToken) { response ->
                    when (response) {
                        is ApiResponse.Success -> {
                            val liveProfile = response.data
                            Log.d(TAG, "Token verified with backend. Role: ${liveProfile.role}, Status: ${liveProfile.status}")

                            if (liveProfile.status.equals("Active", ignoreCase = true)) {
                                backgroundExecutor.execute {
                                    authSessionDao.updateCachedProfile(
                                        fullName = liveProfile.fullName,
                                        accountStatus = liveProfile.status
                                    )
                                    runOnUiThread {
                                        setLoading(false)
                                        navigateToDashboard(liveProfile.role)
                                    }
                                }
                            } else {
                                handleInvalidOrInactiveSession("Account status is '${liveProfile.status}'. Please sign in again.")
                            }
                        }

                        is ApiResponse.ServerError -> {
                            // 401 Unauthorized or 403 Forbidden - clear session and require login
                            Log.w(TAG, "Token verification failed (${response.statusCode}): ${response.message}")
                            handleInvalidOrInactiveSession(response.message)
                        }

                        is ApiResponse.NetworkFailure -> {
                            Log.e(TAG, "Network failure while verifying startup token", response.exception)
                            runOnUiThread {
                                setLoading(false)
                                MaterialAlertDialogBuilder(this)
                                    .setTitle(R.string.network_error_title)
                                    .setMessage("Unable to verify session with backend server. Would you like to retry or sign in manually?")
                                    .setPositiveButton(R.string.retry) { _, _ ->
                                        verifyRememberedSessionOnStartup()
                                    }
                                    .setNegativeButton("Manual Sign In", null)
                                    .show()
                            }
                        }

                        else -> {
                            handleInvalidOrInactiveSession("Session verification failed. Please sign in.")
                        }
                    }
                }
            } else {
                Log.d(TAG, "No cached session or token found. Presenting Login screen.")
            }
        }
    }

    private fun handleInvalidOrInactiveSession(message: String) {
        backgroundExecutor.execute {
            authSessionDao.deleteSession()
            tokenManager.clearToken()

            runOnUiThread {
                setLoading(false)
                MaterialAlertDialogBuilder(this)
                    .setTitle("Session Expired")
                    .setMessage(message)
                    .setPositiveButton(R.string.dismiss, null)
                    .show()
            }
        }
    }

    private fun performLogin() {
        val identifier = etIdentifier.text?.toString()?.trim().orEmpty()
        val password = etPassword.text?.toString().orEmpty() // Whitespace preserved

        if (!validateInputs(identifier, password)) {
            Log.d(TAG, "Validation failed for login inputs.")
            return
        }

        setLoading(true)
        Log.d(TAG, "Submitting login request to POST /api/auth/login for identifier: $identifier")

        val request = LoginRequestDto(
            identifier = identifier,
            password = password
        )

        authApiClient.login(request) { response ->
            setLoading(false)
            handleLoginResponse(response)
        }
    }

    private fun validateInputs(identifier: String, password: String): Boolean {
        var isValid = true

        if (identifier.isEmpty()) {
            tilIdentifier.error = getString(R.string.login_error_empty_identifier)
            isValid = false
        } else {
            tilIdentifier.error = null
        }

        if (password.isEmpty()) {
            tilPassword.error = getString(R.string.login_error_empty_password)
            isValid = false
        } else {
            tilPassword.error = null
        }

        return isValid
    }

    private fun handleLoginResponse(response: ApiResponse<LoginResponseDto>) {
        when (response) {
            is ApiResponse.Success -> {
                val loginData = response.data
                val token = loginData.token
                val user = loginData.user

                Log.d(TAG, "Login 200 OK received for User ID: ${user.id}, Role: ${user.role}, Status: ${user.status}")

                if (token.isBlank()) {
                    MaterialAlertDialogBuilder(this)
                        .setTitle("Authentication Error")
                        .setMessage("Authentication token missing from server response.")
                        .setPositiveButton(R.string.dismiss, null)
                        .show()
                    return
                }

                if (!user.status.equals("Active", ignoreCase = true)) {
                    MaterialAlertDialogBuilder(this)
                        .setTitle("Account Access Restricted")
                        .setMessage("Account status is '${user.status}'. Active status is required to access the mobile application.")
                        .setPositiveButton(R.string.dismiss, null)
                        .show()
                    return
                }

                when (user.role) {
                    "Backoffice" -> {
                        MaterialAlertDialogBuilder(this)
                            .setTitle("Web Portal Access Only")
                            .setMessage("The Backoffice administrative portal is available exclusively on the web client (http://localhost:5173).")
                            .setPositiveButton(R.string.dismiss, null)
                            .show()
                    }

                    "Prosumer", "GridOperator" -> {
                        persistSessionAndNavigate(user, token)
                    }

                    else -> {
                        MaterialAlertDialogBuilder(this)
                            .setTitle("Unrecognized Role")
                            .setMessage("Unrecognized account role '${user.role}'. Please contact system support.")
                            .setPositiveButton(R.string.dismiss, null)
                            .show()
                    }
                }
            }

            is ApiResponse.ServerError -> {
                Log.w(TAG, "Login server error (${response.statusCode}): ${response.message}")
                val title = when (response.statusCode) {
                    403 -> "Account Access Restricted"
                    401 -> "Authentication Failed"
                    else -> "Login Error"
                }

                MaterialAlertDialogBuilder(this)
                    .setTitle(title)
                    .setMessage(response.message)
                    .setPositiveButton(R.string.dismiss, null)
                    .show()
            }

            is ApiResponse.ValidationError -> {
                Log.w(TAG, "Login validation error: ${response.rawMessage}")
                MaterialAlertDialogBuilder(this)
                    .setTitle("Validation Error")
                    .setMessage(response.rawMessage)
                    .setPositiveButton(R.string.dismiss, null)
                    .show()
            }

            is ApiResponse.NetworkFailure -> {
                Log.e(TAG, "Login network failure", response.exception)
                MaterialAlertDialogBuilder(this)
                    .setTitle(R.string.network_error_title)
                    .setMessage(R.string.network_error_msg)
                    .setPositiveButton(R.string.retry) { _, _ ->
                        performLogin()
                    }
                    .setNegativeButton(R.string.cancel, null)
                    .show()
            }

            is ApiResponse.Conflict -> {
                MaterialAlertDialogBuilder(this)
                    .setTitle("Error")
                    .setMessage(response.message)
                    .setPositiveButton(R.string.dismiss, null)
                    .show()
            }
        }
    }

    private fun persistSessionAndNavigate(
        user: AuthenticatedUserDto,
        token: String
    ) {
        setLoading(true)

        val sessionEntity = AuthSessionEntity(
            id = 1L,
            nic = user.nic.ifBlank { user.id },
            fullName = user.fullName.takeIf { it.isNotBlank() },
            role = user.role,
            accountStatus = user.status,
            loggedInAt = System.currentTimeMillis()
        )

        backgroundExecutor.execute {
            tokenManager.saveToken(token)
            val saveSuccess = authSessionDao.saveSession(sessionEntity)

            runOnUiThread {
                setLoading(false)
                if (saveSuccess) {
                    Log.d(TAG, "Saved SQLite session & token for ${user.role}. Routing to dashboard...")
                    navigateToDashboard(user.role)
                } else {
                    Log.e(TAG, "Failed to persist local session in SQLite database.")
                    tokenManager.clearToken()
                    MaterialAlertDialogBuilder(this)
                        .setTitle("Session Storage Error")
                        .setMessage("Failed to save local session to device storage. Please try again.")
                        .setPositiveButton(R.string.dismiss, null)
                        .show()
                }
            }
        }
    }

    private fun navigateToDashboard(role: String) {
        val destinationClass = if (role.equals("Prosumer", ignoreCase = true)) {
            ProsumerDashboardActivity::class.java
        } else {
            GridOperatorDashboardActivity::class.java
        }

        val intent = Intent(this, destinationClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }

    private fun setLoading(isLoading: Boolean) {
        btnLogin.isEnabled = !isLoading
        progressBarLogin.visibility = if (isLoading) View.VISIBLE else View.GONE
    }

    companion object {
        private const val TAG = "LoginActivity"
    }
}
