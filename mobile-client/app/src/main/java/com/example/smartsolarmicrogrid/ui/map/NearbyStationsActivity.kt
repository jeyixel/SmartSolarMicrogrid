package com.example.smartsolarmicrogrid.ui.map

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.example.smartsolarmicrogrid.R
import com.example.smartsolarmicrogrid.data.model.StationDetailDto
import com.example.smartsolarmicrogrid.data.model.StationMapSummaryDto
import com.example.smartsolarmicrogrid.data.remote.ApiClient
import com.example.smartsolarmicrogrid.data.repository.StationRepository
import com.example.smartsolarmicrogrid.databinding.ActivityNearbyStationsBinding
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import com.example.smartsolarmicrogrid.ui.dashboard.ProsumerDashboardActivity
import com.example.smartsolarmicrogrid.ui.profile.ProfileActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.bottomnavigation.BottomNavigationView
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Locale

/**
 * "Nearby Solar Stations" screen.
 *
 * Responsibilities are deliberately limited to Android concerns: request the
 * location permission, set up the map, draw markers, and render whatever state
 * the ViewModel publishes. It performs no networking itself.
 */
class NearbyStationsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityNearbyStationsBinding
    private val viewModel: NearbyStationsViewModel by viewModels()

    private lateinit var webView: WebView
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    /** Last point the station list was requested for; reused by Retry. */
    private var lastQueriedLocationLat = 6.9271
    private var lastQueriedLocationLng = 79.8612

    private var mapLoaded = false

    /**
     * Android 12+ lets the user grant only approximate location, so the result
     * is a map of both permissions and either one being granted is enough.
     */
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (granted) {
            moveToCurrentLocationAndLoad()
        } else {
            showMessage(getString(R.string.msg_permission_denied))
            loadStationsAround(6.9271, 79.8612)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNearbyStationsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        ApiClient.init(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        webView = binding.mapWebView
        webView.settings.javaScriptEnabled = true
        webView.addJavascriptInterface(WebAppInterface(), "Android")
        
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                mapLoaded = true
                if (!viewModel.hasLoadedOnce) {
                    requestLocationOrFallback()
                } else {
                    updateMapCenter(lastQueriedLocationLat, lastQueriedLocationLng)
                    (viewModel.uiState.value as? StationsUiState.Success)?.let {
                        drawMarkers(it.stations)
                    }
                }
            }
        }
        webView.loadUrl("file:///android_asset/leaflet_map.html")

        binding.retryButton.setOnClickListener {
            hideMessage()
            requestLocationOrFallback()
        }

        binding.detailsPanel.detailCloseButton.setOnClickListener {
            viewModel.dismissDetails()
        }

        // Member 3 Integration Handoff Point
        binding.detailsPanel.detailBookButton.setOnClickListener {
            val currentState = viewModel.detailState.value
            if (currentState is StationDetailUiState.Success) {
                val stationId = currentState.station.id
                val stationName = currentState.station.name
                
                // Show a Toast to prove the integration works for the Viva
                Toast.makeText(
                    this, 
                    "Handing off to Member 3 Booking...\nStation: $stationName", 
                    Toast.LENGTH_LONG
                ).show()

                // Intent placeholder for Member 3:
                /*
                val intent = Intent(this, BookSlotActivity::class.java).apply {
                    putExtra("EXTRA_STATION_ID", stationId)
                    putExtra("EXTRA_STATION_NAME", stationName)
                }
                startActivity(intent)
                */
            }
        }

        setupNavigation()
        observeViewModel()
    }

    private fun setupNavigation() {
        val topToolbar = findViewById<MaterialToolbar>(R.id.topToolbar)
        topToolbar.setNavigationOnClickListener {
            finish()
        }

        val bottomNav = findViewById<BottomNavigationView>(R.id.bottomNavigation)
        bottomNav.selectedItemId = R.id.nav_map
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> {
                    startActivity(Intent(this, ProsumerDashboardActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
                    })
                    true
                }
                R.id.nav_map -> true
                R.id.nav_profile -> {
                    startActivity(Intent(this, ProfileActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
                    })
                    true
                }
                else -> false
            }
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun onMarkerClick(stationId: String) {
            runOnUiThread {
                viewModel.loadStationDetails(stationId)
            }
        }
    }

    // -- Location ------------------------------------------------------------

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

    private fun requestLocationOrFallback() {
        if (hasLocationPermission()) {
            moveToCurrentLocationAndLoad()
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    @SuppressLint("MissingPermission")
    private fun moveToCurrentLocationAndLoad() {
        if (!hasLocationPermission()) {
            loadStationsAround(6.9271, 79.8612)
            return
        }

        fusedLocationClient.getCurrentLocation(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            null
        ).addOnSuccessListener { location ->
            if (location == null) {
                showMessage(getString(R.string.msg_location_unavailable))
                loadStationsAround(6.9271, 79.8612)
            } else {
                updateMapCenter(location.latitude, location.longitude)
                loadStationsAround(location.latitude, location.longitude)
            }
        }.addOnFailureListener {
            showMessage(getString(R.string.msg_location_unavailable))
            loadStationsAround(6.9271, 79.8612)
        }
    }

    private fun loadStationsAround(lat: Double, lng: Double) {
        lastQueriedLocationLat = lat
        lastQueriedLocationLng = lng
        updateMapCenter(lat, lng)
        viewModel.loadNearbyStations(lat, lng)
    }

    private fun updateMapCenter(lat: Double, lng: Double) {
        if (!mapLoaded) return
        webView.evaluateJavascript("javascript:setCenter($lat, $lng, 12);", null)
    }

    // -- State rendering -----------------------------------------------------

    private fun observeViewModel() {
        // repeatOnLifecycle stops collection when the screen is not visible,
        // so no UI update is attempted against a destroyed view.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { viewModel.uiState.collect { renderStations(it) } }
                launch { viewModel.detailState.collect { renderDetails(it) } }
            }
        }
    }

    private fun renderStations(state: StationsUiState) {
        binding.loadingIndicator.visibility =
            if (state is StationsUiState.Loading) View.VISIBLE else View.GONE

        when (state) {
            is StationsUiState.Idle, is StationsUiState.Loading -> Unit

            is StationsUiState.Success -> {
                hideMessage()
                drawMarkers(state.stations)
            }

            is StationsUiState.Empty -> {
                clearMarkers()
                showMessage(
                    getString(
                        R.string.msg_no_stations,
                        formatNumber(StationRepository.DEFAULT_RADIUS_KM)
                    )
                )
            }

            is StationsUiState.Error -> {
                clearMarkers()
                showMessage(state.message)
            }
        }
    }

    private fun drawMarkers(stations: List<StationMapSummaryDto>) {
        if (!mapLoaded) return
        clearMarkers()

        stations.forEach { station ->
            val lat = station.latitude ?: return@forEach
            val lng = station.longitude ?: return@forEach
            
            val nameEscaped = station.name.replace("'", "\\'")
            val isActive = station.isOpenNow == true
            
            webView.evaluateJavascript(
                "javascript:addMarker('${station.id}', $lat, $lng, '$nameEscaped', $isActive);", 
                null
            )
        }
    }

    private fun clearMarkers() {
        if (!mapLoaded) return
        webView.evaluateJavascript("javascript:clearMarkers();", null)
    }

    private fun renderDetails(state: StationDetailUiState) {
        val panel = binding.detailsPanel

        when (state) {
            is StationDetailUiState.Hidden -> panel.detailsCard.visibility = View.GONE

            is StationDetailUiState.Loading -> {
                panel.detailsCard.visibility = View.VISIBLE
                panel.detailLoading.visibility = View.VISIBLE
                panel.detailName.text = ""
                panel.detailStatusPill.visibility = View.GONE
                panel.detailCode.visibility = View.GONE
                panel.detailAddress.visibility = View.GONE
                panel.detailDescription.visibility = View.GONE
                panel.detailOperatingHours.visibility = View.GONE
                panel.detailCapacity.visibility = View.GONE
                panel.detailSlots.visibility = View.GONE
                panel.detailPhone.visibility = View.GONE
            }

            is StationDetailUiState.Success -> {
                panel.detailsCard.visibility = View.VISIBLE
                panel.detailLoading.visibility = View.GONE
                bindStationDetails(state.station)
            }

            is StationDetailUiState.Error -> {
                panel.detailsCard.visibility = View.VISIBLE
                panel.detailLoading.visibility = View.GONE
                panel.detailName.text = state.message
                panel.detailStatusPill.visibility = View.GONE
                panel.detailCode.visibility = View.GONE
                panel.detailAddress.visibility = View.GONE
                panel.detailDescription.visibility = View.GONE
                panel.detailOperatingHours.visibility = View.GONE
                panel.detailCapacity.visibility = View.GONE
                panel.detailSlots.visibility = View.GONE
                panel.detailPhone.visibility = View.GONE
            }
        }
    }

    private fun bindStationDetails(station: StationDetailDto) {
        val panel = binding.detailsPanel

        panel.detailName.text = station.name
        
        // Setup Active / Closed pill
        if (station.isOpenNow == true) {
            panel.detailStatusPill.visibility = View.VISIBLE
            panel.detailStatusPill.text = "● Active"
            panel.detailStatusPill.setBackgroundResource(R.drawable.bg_pill_active)
            panel.detailStatusPill.setTextColor(ContextCompat.getColor(this, R.color.solar_green_primary))
        } else {
            panel.detailStatusPill.visibility = View.VISIBLE
            panel.detailStatusPill.text = "● Closed"
            panel.detailStatusPill.setBackgroundResource(R.drawable.bg_pill_review)
            panel.detailStatusPill.setTextColor(ContextCompat.getColor(this, R.color.solar_amber))
        }

        bindOptionalText(panel.detailCode, getString(R.string.fmt_station_code, station.stationCode))
        bindOptionalText(panel.detailAddress, station.addressLine)
        bindOptionalText(panel.detailDescription, station.description)

        // Find today's operating hours using standard Calendar (API 24 compatible)
        val calendar = Calendar.getInstance()
        val dayString = calendar.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.LONG, Locale.getDefault())
        val todaysSchedule = station.operationalSchedule?.find { it.dayOfWeek.equals(dayString, ignoreCase = true) }
        
        if (todaysSchedule != null) {
            if (todaysSchedule.isClosed == true) {
                bindOptionalText(panel.detailOperatingHours, getString(R.string.label_closed_now))
            } else {
                bindOptionalText(panel.detailOperatingHours, "${getString(R.string.label_operating_hours)}: ${todaysSchedule.openTime} - ${todaysSchedule.closeTime}")
            }
        } else {
            panel.detailOperatingHours.visibility = View.GONE
        }

        bindOptionalText(
            panel.detailCapacity,
            station.capacityKWh?.let { getString(R.string.fmt_capacity, formatNumber(it)) }
        )

        bindOptionalText(
            panel.detailSlots,
            if (station.availableBatterySlots != null && station.totalBatterySlots != null) {
                getString(
                    R.string.fmt_slots,
                    station.availableBatterySlots,
                    station.totalBatterySlots
                )
            } else {
                null
            }
        )

        bindOptionalText(
            panel.detailPhone,
            station.contactPhone
                ?.takeIf { it.isNotBlank() }
                ?.let { getString(R.string.fmt_contact, it) }
        )
    }

    /** Hides a field entirely when the API sent null, rather than printing "null". */
    private fun bindOptionalText(view: TextView, value: String?) {
        if (value.isNullOrBlank()) {
            view.visibility = View.GONE
        } else {
            view.visibility = View.VISIBLE
            view.text = value
        }
    }

    private fun showMessage(message: String) {
        binding.messageText.text = message
        binding.messageCard.visibility = View.VISIBLE
    }

    private fun hideMessage() {
        binding.messageCard.visibility = View.GONE
    }

    private fun formatNumber(value: Double): String =
        String.format(Locale.getDefault(), "%.1f", value)

    companion object {
        private const val SEPARATOR = "  •  "
    }
}
