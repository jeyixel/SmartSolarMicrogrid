package com.example.smartsolarmicrogrid.ui.map

import android.Manifest
import android.annotation.SuppressLint
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
import com.example.smartsolarmicrogrid.data.repository.StationRepository
import com.example.smartsolarmicrogrid.databinding.ActivityNearbyStationsBinding
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.launch
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

    private var googleMap: GoogleMap? = null
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    /**
     * Marker -> station id. A Marker cannot carry a typed object, so the id is
     * kept beside it and looked up on click. This is how a tapped marker is
     * resolved back to the station it represents.
     */
    private val markerStationIds = mutableMapOf<Marker, String>()

    /** Last point the station list was requested for; reused by Retry. */
    private var lastQueriedLocation: LatLng? = null

    /**
     * Fallback camera position (Colombo), used when the user denies location
     * or no fix is available. The screen must stay usable in that case.
     */
    private val fallbackLocation = LatLng(6.9271, 79.8612)

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
            loadStationsAround(fallbackLocation)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNearbyStationsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val mapFragment = supportFragmentManager
            .findFragmentById(R.id.mapFragment) as SupportMapFragment
        // The map is not usable synchronously; onMapReady is the entry point.
        mapFragment.getMapAsync(this)

        binding.retryButton.setOnClickListener {
            hideMessage()
            loadStationsAround(lastQueriedLocation ?: fallbackLocation)
        }

        binding.detailsPanel.detailCloseButton.setOnClickListener {
            viewModel.dismissDetails()
        }

        observeViewModel()
    }

    // -- Map setup -----------------------------------------------------------

    override fun onMapReady(map: GoogleMap) {
        googleMap = map

        map.uiSettings.isZoomControlsEnabled = true
        map.uiSettings.isMyLocationButtonEnabled = true

        // Start somewhere sensible so the user never sees the middle of the
        // ocean while the location fix and the API call are still in flight.
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(fallbackLocation, CITY_ZOOM))

        map.setOnMarkerClickListener { marker ->
            val stationId = markerStationIds[marker]
            if (stationId != null) {
                marker.showInfoWindow()
                viewModel.loadStationDetails(stationId)
                true // handled: suppress the default camera recentre
            } else {
                false
            }
        }

        // Tapping empty map dismisses the details panel.
        map.setOnMapClickListener { viewModel.dismissDetails() }

        // Stations already loaded before the map became ready (for example
        // after a rotation) must be drawn now.
        (viewModel.uiState.value as? StationsUiState.Success)?.let {
            drawMarkers(it.stations)
        }

        if (!viewModel.hasLoadedOnce) {
            requestLocationOrFallback()
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
            enableMyLocationLayer()
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

    /**
     * Guarded by an explicit permission check, so the SuppressLint is safe:
     * this runs only after a grant.
     */
    @SuppressLint("MissingPermission")
    private fun enableMyLocationLayer() {
        if (hasLocationPermission()) {
            googleMap?.isMyLocationEnabled = true
        }
    }

    @SuppressLint("MissingPermission")
    private fun moveToCurrentLocationAndLoad() {
        if (!hasLocationPermission()) {
            loadStationsAround(fallbackLocation)
            return
        }

        // getCurrentLocation rather than lastLocation: a fresh emulator, or a
        // phone that has not fixed recently, returns null for the cached value.
        fusedLocationClient.getCurrentLocation(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            CancellationTokenSource().token
        ).addOnSuccessListener { location ->
            if (location == null) {
                showMessage(getString(R.string.msg_location_unavailable))
                loadStationsAround(fallbackLocation)
            } else {
                val here = LatLng(location.latitude, location.longitude)
                googleMap?.animateCamera(
                    CameraUpdateFactory.newLatLngZoom(here, CITY_ZOOM)
                )
                loadStationsAround(here)
            }
        }.addOnFailureListener {
            showMessage(getString(R.string.msg_location_unavailable))
            loadStationsAround(fallbackLocation)
        }
    }

    private fun loadStationsAround(location: LatLng) {
        lastQueriedLocation = location
        viewModel.loadNearbyStations(location.latitude, location.longitude)
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
        val map = googleMap ?: return
        clearMarkers()

        stations.forEach { station ->
            // The repository has already discarded unusable coordinates, so a
            // null here would be a programming error rather than bad data.
            val lat = station.latitude ?: return@forEach
            val lng = station.longitude ?: return@forEach

            val marker = map.addMarker(
                MarkerOptions()
                    .position(LatLng(lat, lng))
                    .title(station.name)
                    .snippet(buildSnippet(station))
                    .icon(
                        BitmapDescriptorFactory.defaultMarker(
                            if (station.isOpenNow == false) {
                                BitmapDescriptorFactory.HUE_ORANGE
                            } else {
                                BitmapDescriptorFactory.HUE_GREEN
                            }
                        )
                    )
            )

            if (marker != null) {
                markerStationIds[marker] = station.id
            }
        }
    }

    private fun buildSnippet(station: StationMapSummaryDto): String {
        val parts = mutableListOf<String>()
        station.distanceKm?.let {
            parts += getString(R.string.fmt_marker_snippet, formatNumber(it))
        }
        station.availableBatterySlots?.let {
            parts += resources.getQuantityString(R.plurals.slots_free, it, it)
        }
        return if (parts.isEmpty()) station.stationCode else parts.joinToString(SEPARATOR)
    }

    private fun clearMarkers() {
        markerStationIds.keys.forEach { it.remove() }
        markerStationIds.clear()
    }

    private fun renderDetails(state: StationDetailUiState) {
        val panel = binding.detailsPanel

        when (state) {
            is StationDetailUiState.Hidden -> panel.detailsCard.visibility = View.GONE

            is StationDetailUiState.Loading -> {
                panel.detailsCard.visibility = View.VISIBLE
                panel.detailLoading.visibility = View.VISIBLE
                panel.detailName.text = ""
                panel.detailCode.visibility = View.GONE
                panel.detailAddress.visibility = View.GONE
                panel.detailDescription.visibility = View.GONE
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
                panel.detailCode.visibility = View.GONE
                panel.detailAddress.visibility = View.GONE
                panel.detailDescription.visibility = View.GONE
                panel.detailCapacity.visibility = View.GONE
                panel.detailSlots.visibility = View.GONE
                panel.detailPhone.visibility = View.GONE
            }
        }
    }

    private fun bindStationDetails(station: StationDetailDto) {
        val panel = binding.detailsPanel

        panel.detailName.text = station.name

        val openLabel = when (station.isOpenNow) {
            true -> getString(R.string.label_open_now)
            false -> getString(R.string.label_closed_now)
            null -> null
        }
        bindOptionalText(
            panel.detailCode,
            listOfNotNull(
                getString(R.string.fmt_station_code, station.stationCode),
                openLabel
            ).joinToString(SEPARATOR)
        )

        bindOptionalText(panel.detailAddress, station.addressLine)
        bindOptionalText(panel.detailDescription, station.description)

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
        private const val CITY_ZOOM = 12f
        private const val SEPARATOR = "  •  "
    }
}
