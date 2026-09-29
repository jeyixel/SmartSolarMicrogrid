package com.example.smartsolarmicrogrid.data.remote

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.DashboardStatsDto
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/**
 * Native HTTP client for Reservation and Grid Operations endpoints.
 * Strictly adheres to pure Android architecture without third-party network frameworks.
 */
class ReservationApiClient(
    private val baseUrl: String = DEFAULT_BASE_URL
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
        const val DEFAULT_BASE_URL = "http://10.0.2.2:5127/"
        private const val CONNECT_TIMEOUT_MS = 10000
        private const val READ_TIMEOUT_MS = 10000
    }
}
