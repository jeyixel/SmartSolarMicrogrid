package com.example.smartsolarmicrogrid.data.remote

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.CreateReservationRequestDto
import com.example.smartsolarmicrogrid.data.remote.dto.DashboardStatsDto
import com.example.smartsolarmicrogrid.data.remote.dto.EnergyReservationDto
import com.example.smartsolarmicrogrid.data.remote.dto.ReservationHistoryDto
import com.example.smartsolarmicrogrid.data.remote.dto.SlotDto
import com.example.smartsolarmicrogrid.data.remote.dto.StationLookupDto
import com.example.smartsolarmicrogrid.data.remote.dto.UpdateReservationRequestDto
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/**
 * Native HTTP client for Reservation and Grid Operations endpoints.
 * Strictly adheres to pure Android architecture without third-party network frameworks.
 */
class ReservationApiClient(
    private val baseUrl: String = ApiConfig.getBaseUrl()
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Fetches live dashboard statistics for the specified prosumer NIC.
     */
    fun getDashboardStats(
        nic: String,
        authToken: String? = null,
        callback: (ApiResponse<DashboardStatsDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val encodedNic = URLEncoder.encode(nic, "UTF-8")
                val endpointUrl = URL("${baseUrl}api/reservations/dashboard/$encodedNic")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Accept", "application/json")
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "getDashboardStats status: $responseCode, response: $responseBody")

                val result: ApiResponse<DashboardStatsDto> = when (responseCode) {
                    200 -> {
                        val json = JSONObject(responseBody)
                        ApiResponse.Success(DashboardStatsDto.fromJson(json), responseCode)
                    }
                    in 400..499 -> {
                        val message = parseErrorMessage(responseBody) ?: "Unable to fetch dashboard statistics."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Server error occurred ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in getDashboardStats", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Fetches booking history for the specified prosumer NIC with optional criteria filtering.
     */
    fun getBookingHistory(
        nic: String,
        status: String? = null,
        fromDate: String? = null,
        toDate: String? = null,
        search: String? = null,
        authToken: String? = null,
        callback: (ApiResponse<List<ReservationHistoryDto>>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val encodedNic = URLEncoder.encode(nic, "UTF-8")
                val queryParams = mutableListOf<String>()
                if (!status.isNullOrBlank() && status != "All") {
                    queryParams.add("status=" + URLEncoder.encode(status, "UTF-8"))
                }
                if (!fromDate.isNullOrBlank()) {
                    queryParams.add("fromDate=" + URLEncoder.encode(fromDate, "UTF-8"))
                }
                if (!toDate.isNullOrBlank()) {
                    queryParams.add("toDate=" + URLEncoder.encode(toDate, "UTF-8"))
                }
                if (!search.isNullOrBlank()) {
                    queryParams.add("search=" + URLEncoder.encode(search, "UTF-8"))
                }

                val queryString = if (queryParams.isNotEmpty()) "?" + queryParams.joinToString("&") else ""
                val endpointUrl = URL("${baseUrl}api/reservations/history/$encodedNic$queryString")

                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Accept", "application/json")
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "getBookingHistory status: $responseCode, response: $responseBody")

                val result: ApiResponse<List<ReservationHistoryDto>> = when (responseCode) {
                    200 -> {
                        val jsonArray = JSONArray(responseBody)
                        ApiResponse.Success(ReservationHistoryDto.fromJsonArray(jsonArray), responseCode)
                    }
                    in 400..499 -> {
                        val message = parseErrorMessage(responseBody) ?: "Unable to fetch booking history."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Server error occurred ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in getBookingHistory", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Generates or retrieves the dynamic QR verification payload for a reservation.
     */
    fun generateQrCode(
        reservationId: String,
        authToken: String? = null,
        callback: (ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.QrCodeDetailsDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val encodedId = URLEncoder.encode(reservationId, "UTF-8")
                val endpointUrl = URL("${baseUrl}api/reservations/$encodedId/qr")

                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Accept", "application/json")
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "generateQrCode status: $responseCode, response: $responseBody")

                val result: ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.QrCodeDetailsDto> = when (responseCode) {
                    200 -> {
                        val json = JSONObject(responseBody)
                        val dto = com.example.smartsolarmicrogrid.data.remote.dto.QrCodeDetailsDto(
                            reservationId = json.optString("reservationId", reservationId),
                            reservationCode = json.optString("reservationCode", ""),
                            qrCodeToken = json.optString("qrCodeToken", ""),
                            stationId = json.optString("stationId", "N/A"),
                            stationName = json.optString("stationName", ""),
                            prosumerNIC = json.optString("prosumerNIC", ""),
                            prosumerName = json.optString("prosumerName", ""),
                            slotStartTime = json.optString("slotStartTime", ""),
                            slotEndTime = json.optString("slotEndTime", ""),
                            requestedKWh = json.optDouble("requestedKWh", 0.0),
                            actionType = json.optString("actionType", "Charging"),
                            status = json.optString("status", "Pending"),
                            generatedAtUtc = json.optString("generatedAtUtc", "")
                        )
                        ApiResponse.Success(dto, responseCode)
                    }
                    in 400..499 -> {
                        val message = parseErrorMessage(responseBody) ?: "Unable to generate QR code."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Server error occurred ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in generateQrCode", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Member 3: Fetches minimal station identity records for station selection dropdowns.
     * Calls GET /api/stations/lookup on the FAT Web API.
     */
    fun getStationLookup(
        authToken: String? = null,
        callback: (ApiResponse<List<StationLookupDto>>) -> Unit
    ) {
        executor.execute {
            // Background network execution using HttpURLConnection
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/stations/lookup")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Accept", "application/json")
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "getStationLookup status: $responseCode, response: $responseBody")

                val result: ApiResponse<List<StationLookupDto>> = when (responseCode) {
                    200 -> {
                        val jsonArray = JSONArray(responseBody)
                        ApiResponse.Success(StationLookupDto.fromJsonArray(jsonArray), responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Unable to fetch solar stations ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in getStationLookup", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Member 3: Fetches available energy booking slots for a specified solar station.
     * Calls GET /api/slots/by-station/{stationId} on the FAT Web API.
     */
    fun getSlotsByStation(
        stationId: String,
        authToken: String? = null,
        callback: (ApiResponse<List<SlotDto>>) -> Unit
    ) {
        executor.execute {
            // Query station physical slots on worker thread
            var connection: HttpURLConnection? = null
            try {
                val encodedStationId = URLEncoder.encode(stationId, "UTF-8")
                val endpointUrl = URL("${baseUrl}api/slots/by-station/$encodedStationId")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Accept", "application/json")
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "getSlotsByStation status: $responseCode, response: $responseBody")

                val result: ApiResponse<List<SlotDto>> = when (responseCode) {
                    200 -> {
                        val jsonArray = JSONArray(responseBody)
                        ApiResponse.Success(SlotDto.fromJsonArray(jsonArray), responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Unable to fetch booking slots ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in getSlotsByStation", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Member 3: Fetches a single reservation record by its unique identifier.
     * Calls GET /api/reservations/{id} on the FAT Web API.
     */
    fun getReservationById(
        reservationId: String,
        authToken: String? = null,
        callback: (ApiResponse<EnergyReservationDto>) -> Unit
    ) {
        executor.execute {
            // Retrieve single reservation details
            var connection: HttpURLConnection? = null
            try {
                val encodedId = URLEncoder.encode(reservationId, "UTF-8")
                val endpointUrl = URL("${baseUrl}api/reservations/$encodedId")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Accept", "application/json")
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "getReservationById status: $responseCode, response: $responseBody")

                val result: ApiResponse<EnergyReservationDto> = when (responseCode) {
                    200 -> {
                        val json = JSONObject(responseBody)
                        ApiResponse.Success(EnergyReservationDto.fromJson(json), responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Unable to fetch reservation ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in getReservationById", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Member 3: Submits a new energy slot reservation.
     * Enforces the 7-day rule and slot capacity atomically on the central C# FAT Web API.
     * Calls POST /api/reservations.
     */
    fun createReservation(
        request: CreateReservationRequestDto,
        userId: String? = null,
        authToken: String? = null,
        callback: (ApiResponse<EnergyReservationDto>) -> Unit
    ) {
        executor.execute {
            // Post reservation payload over HTTP
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/reservations")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                    if (!userId.isNullOrBlank()) {
                        setRequestProperty("X-User-Id", userId)
                    }
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                // Write JSON payload
                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(request.toJson().toString())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "createReservation status: $responseCode, response: $responseBody")

                val result: ApiResponse<EnergyReservationDto> = when (responseCode) {
                    200, 201 -> {
                        val json = JSONObject(responseBody)
                        ApiResponse.Success(EnergyReservationDto.fromJson(json), responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Failed to create reservation ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in createReservation", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Updates an existing reservation's slot or requested capacity.
     * Enforces the 12-hour modification rule and capacity reallocation on the FAT Web API.
     * Calls PUT /api/reservations/{id}.
     */
    fun updateReservation(
        reservationId: String,
        request: UpdateReservationRequestDto,
        userId: String? = null,
        authToken: String? = null,
        callback: (ApiResponse<Unit>) -> Unit
    ) {
        executor.execute {
            // Execute HTTP PUT request on worker thread
            var connection: HttpURLConnection? = null
            try {
                val encodedId = URLEncoder.encode(reservationId, "UTF-8")
                val endpointUrl = URL("${baseUrl}api/reservations/$encodedId")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "PUT"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                    if (!userId.isNullOrBlank()) {
                        setRequestProperty("X-User-Id", userId)
                    }
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                // Write JSON payload
                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(request.toJson().toString())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "updateReservation status: $responseCode, response: $responseBody")

                val result: ApiResponse<Unit> = when (responseCode) {
                    200, 204 -> {
                        ApiResponse.Success(Unit, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Failed to update reservation ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in updateReservation", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Cancels an active reservation and releases its slot capacity.
     * Enforces the 12-hour cancellation rule on the FAT Web API.
     * Calls DELETE /api/reservations/{id}.
     */
    fun cancelReservation(
        reservationId: String,
        userId: String? = null,
        authToken: String? = null,
        callback: (ApiResponse<Unit>) -> Unit
    ) {
        executor.execute {
            // Send cancellation DELETE request
            var connection: HttpURLConnection? = null
            try {
                val encodedId = URLEncoder.encode(reservationId, "UTF-8")
                val endpointUrl = URL("${baseUrl}api/reservations/$encodedId")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "DELETE"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Accept", "application/json")
                    if (!userId.isNullOrBlank()) {
                        setRequestProperty("X-User-Id", userId)
                    }
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "cancelReservation status: $responseCode, response: $responseBody")

                val result: ApiResponse<Unit> = when (responseCode) {
                    200, 204 -> {
                        ApiResponse.Success(Unit, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Failed to cancel reservation ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in cancelReservation", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Verifies a scanned QR code token and completes the energy transfer session.
     */
    fun verifyQrTransfer(
        qrToken: String,
        operatorUserId: String? = null,
        stationId: String? = null,
        authToken: String? = null,
        callback: (ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.EnergyTransferResultDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/reservations/verify-qr")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json")
                    if (!authToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $authToken")
                    }
                }

                val requestJson = JSONObject().apply {
                    put("qrToken", qrToken)
                    if (!operatorUserId.isNullOrBlank()) put("operatorUserId", operatorUserId)
                    if (!stationId.isNullOrBlank()) put("stationId", stationId)
                }

                connection.outputStream.use { os ->
                    os.write(requestJson.toString().toByteArray(Charsets.UTF_8))
                    os.flush()
                }

                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val responseBody = readStream(stream)

                Log.d(TAG, "verifyQrTransfer status: $responseCode, response: $responseBody")

                val result: ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.EnergyTransferResultDto> = when (responseCode) {
                    200 -> {
                        val json = JSONObject(responseBody)
                        val dto = com.example.smartsolarmicrogrid.data.remote.dto.EnergyTransferResultDto.fromJson(json)
                        ApiResponse.Success(dto, responseCode)
                    }
                    in 400..499 -> {
                        val message = parseErrorMessage(responseBody) ?: "Unable to verify energy transfer pass."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Server error occurred ($responseCode)."
                        ApiResponse.ServerError(message, responseCode)
                    }
                }
                postResult(result, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Network failure in verifyQrTransfer", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    private fun readStream(stream: InputStream?): String {
        if (stream == null) return ""
        return BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { reader ->
            reader.readText()
        }
    }

    private fun parseErrorMessage(jsonStr: String): String? {
        return try {
            val json = JSONObject(jsonStr)
            when {
                json.has("error") -> json.getString("error")
                json.has("message") -> json.getString("message")
                json.has("title") -> json.getString("title")
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun <T> postResult(result: ApiResponse<T>, callback: (ApiResponse<T>) -> Unit) {
        mainHandler.post {
            callback(result)
        }
    }

    companion object {
        private const val TAG = "ReservationApiClient"
        private const val CONNECT_TIMEOUT_MS = 10000
        private const val READ_TIMEOUT_MS = 10000
    }
}