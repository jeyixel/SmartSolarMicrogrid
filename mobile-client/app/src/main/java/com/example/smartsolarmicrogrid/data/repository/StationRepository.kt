package com.example.smartsolarmicrogrid.data.repository

import com.example.smartsolarmicrogrid.data.model.StationDetailDto
import com.example.smartsolarmicrogrid.data.model.StationMapSummaryDto
import com.example.smartsolarmicrogrid.data.remote.ApiClient
import com.example.smartsolarmicrogrid.data.remote.StationApiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.Response
import java.io.IOException

/**
 * Single source of station data for the app.
 *
 * Responsibilities:
 *  - call the REST API off the main thread,
 *  - translate HTTP status codes and exceptions into readable messages,
 *  - drop stations whose coordinates are missing or out of range, so that
 *    invalid data can never reach the map layer.
 *
 * The UI layer talks only to this class, so swapping the data source later
 * (adding a cache, changing endpoints) touches nothing above it.
 */
class StationRepository(
    // Resolved lazily so that ApiClient.init() has run before the Retrofit
    // instance (and its auth interceptor) is built.
    apiProvider: () -> StationApiService = { ApiClient.stationApi }
) {

    private val api: StationApiService by lazy(apiProvider)


    suspend fun getNearbyStations(
        latitude: Double,
        longitude: Double,
        radiusKm: Double = DEFAULT_RADIUS_KM
    ): ApiResult<List<StationMapSummaryDto>> = safeCall {
        val response = api.getNearbyStations(
            latitude = latitude,
            longitude = longitude,
            radiusKm = radiusKm
        )
        // An empty body on a 200 is treated as "no stations", not an error.
        response.mapSuccess { it.orEmpty().filter(::hasUsableCoordinates) }
    }

    suspend fun getStationDetails(stationId: String): ApiResult<StationDetailDto> = safeCall {
        api.getStationDetails(stationId).mapSuccess { body ->
            body ?: return@mapSuccess null
        }
    }

    /**
     * A station is plottable only when both coordinates are present and inside
     * the valid latitude/longitude ranges. (0,0) is also rejected: it is in the
     * ocean off Africa and in practice means "never set".
     */
    private fun hasUsableCoordinates(station: StationMapSummaryDto): Boolean {
        val lat = station.latitude ?: return false
        val lng = station.longitude ?: return false
        if (lat.isNaN() || lng.isNaN()) return false
        if (lat !in -90.0..90.0 || lng !in -180.0..180.0) return false
        if (lat == 0.0 && lng == 0.0) return false
        return true
    }

    /**
     * Runs a call on the IO dispatcher and converts anything that goes wrong
     * into an [ApiResult.Error] with a message suitable for the screen.
     */
    private suspend fun <T> safeCall(block: suspend () -> ApiResult<T>): ApiResult<T> =
        withContext(Dispatchers.IO) {
            try {
                block()
            } catch (e: IOException) {
                // No connectivity, DNS failure, timeout, server not running.
                ApiResult.Error(
                    "Cannot reach the server. Check that the API is running " +
                        "and that you are connected to the network."
                )
            } catch (e: Exception) {
                // Malformed JSON, unexpected contract change, anything else.
                ApiResult.Error("Something went wrong while loading stations.")
            }
        }

    /** Maps a Retrofit [Response] onto [ApiResult], naming each failure clearly. */
    private fun <B, T> Response<B>.mapSuccess(transform: (B?) -> T?): ApiResult<T> {
        if (isSuccessful) {
            val value = transform(body())
                ?: return ApiResult.Error("The server returned an empty response.")
            return ApiResult.Success(value)
        }
        val message = when (code()) {
            400 -> "The request was rejected. Please check the search location."
            401, 403 -> "You are not authorised to view stations. Please sign in again."
            404 -> "Station not found."
            in 500..599 -> "The server is having a problem. Please try again later."
            else -> "Unexpected server response (${code()})."
        }
        return ApiResult.Error(message)
    }

    companion object {
        const val DEFAULT_RADIUS_KM = 10.0
    }
}
