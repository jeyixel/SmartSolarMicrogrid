package com.example.smartsolarmicrogrid.data.remote

import com.example.smartsolarmicrogrid.data.model.StationDetailDto
import com.example.smartsolarmicrogrid.data.model.StationMapSummaryDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Declarative description of the station endpoints of the C# Web API.
 *
 * Retrofit generates the implementation at runtime; this interface is only a
 * statement of the contract. Each function is a `suspend` function so the call
 * can be made from a coroutine without ever blocking the main thread.
 *
 * Response<T> is used rather than a bare T so that a non-2xx status (401, 404,
 * 400) can be inspected and turned into a readable message, instead of being
 * thrown as a generic exception.
 */
interface StationApiService {

    /**
     * Active stations within [radiusKm] of the given point, nearest first.
     * An empty array is a valid answer meaning "nothing nearby".
     */
    @GET("api/stations/nearby")
    suspend fun getNearbyStations(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radiusKm") radiusKm: Double = 10.0,
        @Query("limit") limit: Int = 50
    ): Response<List<StationMapSummaryDto>>

    /** Public detail for one station, shown after its marker is tapped. */
    @GET("api/stations/{id}/details")
    suspend fun getStationDetails(
        @Path("id") stationId: String
    ): Response<StationDetailDto>
}
