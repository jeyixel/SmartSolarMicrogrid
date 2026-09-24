package com.example.smartsolarmicrogrid.ui.auth

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.widget.doAfterTextChanged
import com.example.smartsolarmicrogrid.R
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout

/**
 * Entry-point Login activity for the Smart Solar Microgrid mobile application.
 *
 * Security & Lifecycle Rule (Step 14.3):
 * - A local SQLite row contains only cached profile data, not authentication credentials.
 * - On every fresh launch, this Login screen is unconditionally displayed.
 * - Local cached sessions must never authenticate or navigate to role screens on their own.
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var tilIdentifier: TextInputLayout
    private lateinit var etIdentifier: TextInputEditText
    private lateinit var tilPassword: TextInputLayout
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnLogin: MaterialButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_login)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.loginScrollRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        initViews()
        setupListeners()
    }

    private fun initViews() {
        tilIdentifier = findViewById(R.id.tilIdentifier)
        etIdentifier = findViewById(R.id.etIdentifier)
        tilPassword = findViewById(R.id.tilPassword)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
    }

    private fun setupListeners() {
        etIdentifier.doAfterTextChanged {
            tilIdentifier.error = null
        }

        etPassword.doAfterTextChanged {
            tilPassword.error = null
        }

        btnLogin.setOnClickListener {
            validateInputs()
        }
    }

    private fun validateInputs(): Boolean {
        val identifier = etIdentifier.text?.toString()?.trim().orEmpty()
        val password = etPassword.text?.toString().orEmpty()

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
}
