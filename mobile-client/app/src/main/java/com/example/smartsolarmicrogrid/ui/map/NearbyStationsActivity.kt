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
import android.widget.Toast
import com.example.smartsolarmicrogrid.ui.dashboard.ProsumerDashboardActivity
import com.example.smartsolarmicrogrid.ui.profile.ProfileActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MarkerOptions
import com.google.android.gms.maps.model.Marker
import kotlinx.coroutines.launch
import com.google.android.gms.maps.MapsInitializer
import com.google.android.gms.maps.MapsInitializer.Renderer
import java.util.Calendar
import java.util.Locale

/**
 * "Nearby Solar Stations" screen.
 *
 * Responsibilities are deliberately limited to Android concerns: request the
 * location permission, set up the map, draw markers, and render whatever state
 * the ViewModel publishes. It performs no networking itself.
 */
class NearbyStationsActivity : AppCompatActivity(), OnMapReadyCallback {

    private lateinit var binding: ActivityNearbyStationsBinding
    private val viewModel: NearbyStationsViewModel by viewModels()

    private var mMap: GoogleMap? = null
    private val markers = mutableMapOf<String, Marker>()
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
            enableMyLocationLayer()
            moveToCurrentLocationAndLoad()
        } else {
            showMessage(getString(R.string.msg_permission_denied))
            loadStationsAround(6.9271, 79.8612)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Force the Maps SDK to use the Legacy Renderer to bypass the SecurityException
        // in policy_maps_core_dynamite on certain devices/Play Services versions.
        MapsInitializer.initialize(this, Renderer.LEGACY, null)

        binding = ActivityNearbyStationsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        ApiClient.init(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val mapFragment = supportFragmentManager
            .findFragmentById(R.id.mapFragment) as SupportMapFragment
        mapFragment.getMapAsync(this)

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

    override fun onMapReady(googleMap: GoogleMap) {
        mMap = googleMap
        mapLoaded = true

        mMap?.setOnMarkerClickListener { marker ->
            val stationId = marker.tag as? String
            if (stationId != null) {
                viewModel.loadStationDetails(stationId)
            }
            false // Return false so the default behavior (centering the marker and opening info window) still occurs
        }

        enableMyLocationLayer()

        if (!viewModel.hasLoadedOnce) {
            requestLocationOrFallback()
        } else {
            updateMapCenter(lastQueriedLocationLat, lastQueriedLocationLng)
            (viewModel.uiState.value as? StationsUiState.Success)?.let {
                drawMarkers(it.stations)
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

    /**
     * Shows the user's position as the blue "my location" dot, plus the map's
     * recenter button. Safe to call repeatedly; it no-ops until both the map is
     * ready and a location permission has been granted.
     */
    @SuppressLint("MissingPermission")
    private fun enableMyLocationLayer() {
        val map = mMap ?: return
        if (!hasLocationPermission()) return
        map.isMyLocationEnabled = true
        map.uiSettings.isMyLocationButtonEnabled = true
    }

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

        // Use GPS when precise location was granted; Android 12+ users may grant approximate only
        val priority = if (ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            Priority.PRIORITY_HIGH_ACCURACY
        } else {
            Priority.PRIORITY_BALANCED_POWER_ACCURACY
        }

        fusedLocationClient.getCurrentLocation(priority, null).addOnSuccessListener { location ->
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
        mMap?.moveCamera(CameraUpdateFactory.newLatLngZoom(LatLng(lat, lng), 12f))
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
            
            val isActive = station.isOpenNow == true
            
            val markerColor = if (isActive) {
                BitmapDescriptorFactory.HUE_GREEN
            } else {
                BitmapDescriptorFactory.HUE_ORANGE
            }

            val marker = mMap?.addMarker(
                MarkerOptions()
                    .position(LatLng(lat, lng))
                    .title(station.name)
                    .icon(BitmapDescriptorFactory.defaultMarker(markerColor))
            )
            
            if (marker != null) {
                marker.tag = station.id
                markers[station.id] = marker
            }
        }
    }

    private fun clearMarkers() {
        if (!mapLoaded) return
        mMap?.clear()
        markers.clear()
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
