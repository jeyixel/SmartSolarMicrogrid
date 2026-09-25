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
 * Dashboard activity for users with the Active GridOperator role.
 */
class GridOperatorDashboardActivity : AppCompatActivity() {

    private lateinit var tvOperatorWelcome: TextView
    private lateinit var tvOperatorNic: TextView
    private lateinit var tvOperatorRoleStatus: TextView
    private lateinit var btnOperatorLogout: MaterialButton

    private lateinit var authSessionDao: AuthSessionDao
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_grid_operator_dashboard)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.operatorDashboardRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        authSessionDao = AuthSessionDao(this)

        initViews()
        loadSessionData()
        setupListeners()
    }

    private fun initViews() {
        tvOperatorWelcome = findViewById(R.id.tvOperatorWelcome)
        tvOperatorNic = findViewById(R.id.tvOperatorNic)
        tvOperatorRoleStatus = findViewById(R.id.tvOperatorRoleStatus)
        btnOperatorLogout = findViewById(R.id.btnOperatorLogout)
    }

    private fun loadSessionData() {
        executor.execute {
            val session = authSessionDao.readSession()
            runOnUiThread {
                if (session != null) {
                    val displayName = session.fullName ?: "Grid Operator"
                    tvOperatorWelcome.text = "Welcome, $displayName"
                    tvOperatorNic.text = "NIC: ${session.nic}"
                    tvOperatorRoleStatus.text = "Role: ${session.role} | Status: ${session.accountStatus ?: "Active"}"
                }
            }
        }
    }

    private fun setupListeners() {
        btnOperatorLogout.setOnClickListener {
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
