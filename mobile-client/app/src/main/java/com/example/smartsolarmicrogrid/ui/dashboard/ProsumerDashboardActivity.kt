package com.example.smartsolarmicrogrid.ui.dashboard

import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.ui.auth.LoginActivity
import com.google.android.material.button.MaterialButton
import java.util.concurrent.Executors

/**
 * Dashboard activity for users with the Active Prosumer role.
 */
class ProsumerDashboardActivity : AppCompatActivity() {

    private lateinit var tvWelcomeUser: TextView
    private lateinit var tvUserNic: TextView
    private lateinit var tvUserRoleStatus: TextView
    private lateinit var btnManageProfile: MaterialButton
    private lateinit var btnLogout: MaterialButton

    private lateinit var authSessionDao: AuthSessionDao
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_prosumer_dashboard)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.prosumerDashboardRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        authSessionDao = AuthSessionDao(this)

        initViews()
        loadSessionData()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        loadSessionData()
    }

    private fun initViews() {
        tvWelcomeUser = findViewById(R.id.tvWelcomeUser)
        tvUserNic = findViewById(R.id.tvUserNic)
        tvUserRoleStatus = findViewById(R.id.tvUserRoleStatus)
        btnManageProfile = findViewById(R.id.btnManageProfile)
        btnLogout = findViewById(R.id.btnLogout)
    }

    private fun loadSessionData() {
        executor.execute {
            val session = authSessionDao.readSession()
            runOnUiThread {
                if (session != null) {
                    val displayName = session.fullName ?: "Prosumer"
                    tvWelcomeUser.text = "Welcome, $displayName"
                    tvUserNic.text = "NIC: ${session.nic}"
                    tvUserRoleStatus.text = "Role: ${session.role} | Status: ${session.accountStatus ?: "Active"}"
                }
            }
        }
    }

    private fun setupListeners() {
        btnManageProfile.setOnClickListener {
            val intent = Intent(this, com.example.smartsolarmicrogrid.ui.profile.ProfileActivity::class.java)
            startActivity(intent)
        }

        btnLogout.setOnClickListener {
            performLogout()
        }
    }

    private fun performLogout() {
        executor.execute {
            authSessionDao.deleteSession()
            com.example.smartsolarmicrogrid.data.local.TokenManager(this).clearToken()
            runOnUiThread {
                val intent = Intent(this, LoginActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                startActivity(intent)
                finish()
            }
        }
    }
}
