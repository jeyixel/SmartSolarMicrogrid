package com.example.smartsolarmicrogrid.ui.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.smartsolarmicrogrid.data.model.StationDetailDto
import com.example.smartsolarmicrogrid.data.model.StationMapSummaryDto
import com.example.smartsolarmicrogrid.data.repository.ApiResult
import com.example.smartsolarmicrogrid.data.repository.StationRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Every state the map screen can be in. Modelling these explicitly means the
 * Activity only renders what it is told, and no combination such as
 * "loading and error at once" can arise.
 */
sealed class StationsUiState {
    data object Idle : StationsUiState()
    data object Loading : StationsUiState()
    data class Success(val stations: List<StationMapSummaryDto>) : StationsUiState()
    /** A successful call that returned nothing - not an error. */
    data object Empty : StationsUiState()
    data class Error(val message: String) : StationsUiState()
}

/** State of the details panel shown after a marker tap. */
sealed class StationDetailUiState {
    data object Hidden : StationDetailUiState()
    data object Loading : StationDetailUiState()
    data class Success(val station: StationDetailDto) : StationDetailUiState()
    data class Error(val message: String) : StationDetailUiState()
}

/**
 * Holds the state of the Nearby Stations screen.
 *
 * It survives configuration changes, so rotating the device does not re-issue
 * the network call or lose the loaded markers. It knows nothing about Android
 * views, which keeps it testable.
 */
class NearbyStationsViewModel(
    private val repository: StationRepository = StationRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow<StationsUiState>(StationsUiState.Idle)
    val uiState: StateFlow<StationsUiState> = _uiState.asStateFlow()

    private val _detailState = MutableStateFlow<StationDetailUiState>(StationDetailUiState.Hidden)
    val detailState: StateFlow<StationDetailUiState> = _detailState.asStateFlow()

    /** True once stations have been loaded, so the map is not reloaded on rotation. */
    var hasLoadedOnce: Boolean = false
        private set

    fun loadNearbyStations(
        latitude: Double,
        longitude: Double,
        radiusKm: Double = StationRepository.DEFAULT_RADIUS_KM
    ) {
        _uiState.value = StationsUiState.Loading

        viewModelScope.launch {
            when (val result = repository.getNearbyStations(latitude, longitude, radiusKm)) {
                is ApiResult.Success -> {
                    hasLoadedOnce = true
                    _uiState.value = if (result.data.isEmpty()) {
                        StationsUiState.Empty
                    } else {
                        StationsUiState.Success(result.data)
                    }
                }

                is ApiResult.Error -> {
                    _uiState.value = StationsUiState.Error(result.message)
                }
            }
        }
    }

    /** Called when a marker is tapped, with the station id carried by that marker. */
    fun loadStationDetails(stationId: String) {
        _detailState.value = StationDetailUiState.Loading

        viewModelScope.launch {
            _detailState.value = when (val result = repository.getStationDetails(stationId)) {
                is ApiResult.Success -> StationDetailUiState.Success(result.data)
                is ApiResult.Error -> StationDetailUiState.Error(result.message)
            }
        }
    }

    fun dismissDetails() {
        _detailState.value = StationDetailUiState.Hidden
    }
}
