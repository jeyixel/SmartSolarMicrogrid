package com.example.smartsolarmicrogrid.ui.booking

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.local.AuthSessionDao
import com.example.smartsolarmicrogrid.data.local.TokenManager
import com.example.smartsolarmicrogrid.data.remote.ReservationApiClient
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import com.google.android.material.chip.ChipGroup
import java.util.concurrent.Executors

/**
 * Prosumer Booking History and Telemetry Activity.
 * Allows prosumers to query past and active bookings with criteria filtering and search.
 */
class BookingHistoryActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageView
    private lateinit var btnRefresh: ImageView
    private lateinit var etSearch: EditText
    private lateinit var btnClearSearch: ImageView
    private lateinit var chipGroupStatus: ChipGroup
    private lateinit var progressBar: ProgressBar
    private lateinit var rvBookingHistory: RecyclerView
    private lateinit var layoutEmptyState: LinearLayout

    private lateinit var adapter: BookingHistoryAdapter
    private lateinit var authSessionDao: AuthSessionDao
    private lateinit var tokenManager: TokenManager
    private lateinit var reservationApiClient: ReservationApiClient

    private var currentNIC: String = ""
    private var currentToken: String? = null
    private var selectedStatus: String = "All"
    private var currentSearchQuery: String = ""
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_booking_history)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.bookingHistoryRoot)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        authSessionDao = AuthSessionDao(this)
        tokenManager = TokenManager(this)
        reservationApiClient = ReservationApiClient()

        initViews()
        setupListeners()
        loadSessionAndFetchHistory()
    }

    private fun initViews() {
        btnBack = findViewById(R.id.btnBack)
        btnRefresh = findViewById(R.id.btnRefresh)
        etSearch = findViewById(R.id.etSearch)
        btnClearSearch = findViewById(R.id.btnClearSearch)
        chipGroupStatus = findViewById(R.id.chipGroupStatus)
        progressBar = findViewById(R.id.progressBar)
        rvBookingHistory = findViewById(R.id.rvBookingHistory)
        layoutEmptyState = findViewById(R.id.layoutEmptyState)

        adapter = BookingHistoryAdapter { item ->
            val intent = android.content.Intent(this, ReservationQrActivity::class.java).apply {
                putExtra(ReservationQrActivity.EXTRA_RESERVATION_ID, item.id)
            }
            startActivity(intent)
        }

        rvBookingHistory.layoutManager = LinearLayoutManager(this)
        rvBookingHistory.adapter = adapter
    }

    private fun setupListeners() {
        btnBack.setOnClickListener {
            finish()
        }

        btnRefresh.setOnClickListener {
            fetchHistory()
        }

        btnClearSearch.setOnClickListener {
            etSearch.text.clear()
        }

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                currentSearchQuery = s?.toString()?.trim() ?: ""
                btnClearSearch.visibility = if (currentSearchQuery.isNotEmpty()) View.VISIBLE else View.GONE
                fetchHistory()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        chipGroupStatus.setOnCheckedStateChangeListener { _, checkedIds ->
            selectedStatus = when {
                checkedIds.contains(R.id.chipPending) -> "Pending"
                checkedIds.contains(R.id.chipApproved) -> "Approved"
                checkedIds.contains(R.id.chipCompleted) -> "Completed"
                checkedIds.contains(R.id.chipCancelled) -> "Cancelled"
                else -> "All"
            }
            fetchHistory()
        }
    }

    private fun loadSessionAndFetchHistory() {
        executor.execute {
            val session = authSessionDao.readSession()
            val token = tokenManager.getToken()
            runOnUiThread {
                if (session != null) {
                    currentNIC = session.nic
                    currentToken = token
                    fetchHistory()
                } else {
                    Toast.makeText(this, "Session expired. Please log in again.", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
        }
    }

    private fun fetchHistory() {
        if (currentNIC.isBlank()) return

        progressBar.visibility = View.VISIBLE
        layoutEmptyState.visibility = View.GONE

        reservationApiClient.getBookingHistory(
            nic = currentNIC,
            status = if (selectedStatus != "All") selectedStatus else null,
            search = if (currentSearchQuery.isNotBlank()) currentSearchQuery else null,
            authToken = currentToken
        ) { response ->
            progressBar.visibility = View.GONE
            when (response) {
                is ApiResponse.Success -> {
                    val data = response.data
                    adapter.updateItems(data)
                    layoutEmptyState.visibility = if (data.isEmpty()) View.VISIBLE else View.GONE
                }
                is ApiResponse.ServerError -> {
                    Toast.makeText(this, response.message, Toast.LENGTH_SHORT).show()
                    layoutEmptyState.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
                }
                is ApiResponse.NetworkFailure -> {
                    Toast.makeText(this, "Network connection error.", Toast.LENGTH_SHORT).show()
                    layoutEmptyState.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
                }
                else -> {}
            }
        }
    }
}
