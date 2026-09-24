package com.example.smartsolarmicrogrid.data.remote

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.example.smartsolarmicrogrid.data.remote.dto.ApiResponse
import com.example.smartsolarmicrogrid.data.remote.dto.LoginRequestDto
import com.example.smartsolarmicrogrid.data.remote.dto.LoginResponseDto
import com.example.smartsolarmicrogrid.data.remote.dto.RegisterProsumerRequestDto
import com.example.smartsolarmicrogrid.data.remote.dto.RegisterProsumerResponseDto
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Native HTTP client for backend authentication and registration endpoints.
 * Communicates with ASP.NET Core backend over HTTP/REST.
 */
class AuthApiClient(
    private val baseUrl: String = DEFAULT_BASE_URL
) {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    fun login(
        request: LoginRequestDto,
        callback: (ApiResponse<LoginResponseDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/auth/login")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                }

                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(request.toJson())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                val responseBody = readStream(
                    if (responseCode in 200..299) connection.inputStream else connection.errorStream
                )

                Log.d(TAG, "login status: $responseCode, response: $responseBody")

                val result = when (responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val loginResponse = LoginResponseDto.fromJson(responseBody)
                        ApiResponse.Success(loginResponse, responseCode)
                    }
                    HttpURLConnection.HTTP_BAD_REQUEST -> {
                        val fieldErrors = parseValidationErrors(responseBody)
                        val message = parseErrorMessage(responseBody) ?: "Invalid request."
                        ApiResponse.ValidationError(fieldErrors, message)
                    }
                    HttpURLConnection.HTTP_UNAUTHORIZED -> {
                        val message = parseErrorMessage(responseBody) ?: "Invalid email/NIC or password."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    HttpURLConnection.HTTP_FORBIDDEN -> {
                        val message = parseErrorMessage(responseBody) ?: "Account is not active."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Server returned error: $responseCode"
                        ApiResponse.ServerError(message, responseCode)
                    }
                }

                postResult(result, callback)

            } catch (e: Exception) {
                Log.e(TAG, "login connection failure", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    fun registerProsumer(
        request: RegisterProsumerRequestDto,
        callback: (ApiResponse<RegisterProsumerResponseDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/auth/register-prosumer")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                }

                // Write request body
                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(request.toJson())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                val responseBody = readStream(
                    if (responseCode in 200..299) connection.inputStream else connection.errorStream
                )

                Log.d(TAG, "registerProsumer status: $responseCode, response: $responseBody")

                val result = when (responseCode) {
                    HttpURLConnection.HTTP_CREATED -> {
                        val responseDto = RegisterProsumerResponseDto.fromJson(responseBody)
                        ApiResponse.Success(responseDto, responseCode)
                    }
                    HttpURLConnection.HTTP_BAD_REQUEST -> {
                        val fieldErrors = parseValidationErrors(responseBody)
                        ApiResponse.ValidationError(fieldErrors, responseBody)
                    }
                    HttpURLConnection.HTTP_CONFLICT -> {
                        val message = parseErrorMessage(responseBody) ?: "Account already exists."
                        ApiResponse.Conflict(message)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Server returned error: $responseCode"
                        ApiResponse.ServerError(message, responseCode)
                    }
                }

                postResult(result, callback)

            } catch (e: Exception) {
                Log.e(TAG, "registerProsumer connection failure", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    fun getCurrentUser(
        token: String,
        callback: (ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.AuthenticatedUserDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/auth/me")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Accept", "application/json")
                }

                val responseCode = connection.responseCode
                val responseBody = readStream(
                    if (responseCode in 200..299) connection.inputStream else connection.errorStream
                )

                Log.d(TAG, "getCurrentUser status: $responseCode, response: $responseBody")

                val result = when (responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val json = JSONObject(responseBody)
                        val user = com.example.smartsolarmicrogrid.data.remote.dto.AuthenticatedUserDto.fromJson(json)
                        ApiResponse.Success(user, responseCode)
                    }
                    HttpURLConnection.HTTP_UNAUTHORIZED -> {
                        val message = parseErrorMessage(responseBody) ?: "Session expired. Please log in again."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    HttpURLConnection.HTTP_FORBIDDEN -> {
                        val message = parseErrorMessage(responseBody) ?: "Account is not active."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Server error: $responseCode"
                        ApiResponse.ServerError(message, responseCode)
                    }
                }

                postResult(result, callback)

            } catch (e: Exception) {
                Log.e(TAG, "getCurrentUser connection failure", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    fun getProsumerProfile(
        token: String,
        callback: (ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.UserProfileDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/prosumer/profile")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Accept", "application/json")
                }

                val responseCode = connection.responseCode
                val responseBody = readStream(
                    if (responseCode in 200..299) connection.inputStream else connection.errorStream
                )

                Log.d(TAG, "getProsumerProfile status: $responseCode, response: $responseBody")

                val result = when (responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val profile = com.example.smartsolarmicrogrid.data.remote.dto.UserProfileDto.fromJson(responseBody)
                        ApiResponse.Success(profile, responseCode)
                    }
                    HttpURLConnection.HTTP_UNAUTHORIZED -> {
                        val message = parseErrorMessage(responseBody) ?: "Session expired. Please sign in again."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    HttpURLConnection.HTTP_FORBIDDEN -> {
                        val message = parseErrorMessage(responseBody) ?: "Access forbidden."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Failed to load profile (HTTP $responseCode)"
                        ApiResponse.ServerError(message, responseCode)
                    }
                }

                postResult(result, callback)

            } catch (e: Exception) {
                Log.e(TAG, "getProsumerProfile connection failure", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    fun updateProsumerProfile(
        token: String,
        request: com.example.smartsolarmicrogrid.data.remote.dto.UpdateUserProfileRequestDto,
        callback: (ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.UserProfileDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/prosumer/profile")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "PUT"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    doOutput = true
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                }

                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(request.toJson())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                val responseBody = readStream(
                    if (responseCode in 200..299) connection.inputStream else connection.errorStream
                )

                Log.d(TAG, "updateProsumerProfile status: $responseCode, response: $responseBody")

                val result = when (responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val profile = com.example.smartsolarmicrogrid.data.remote.dto.UserProfileDto.fromJson(responseBody)
                        ApiResponse.Success(profile, responseCode)
                    }
                    HttpURLConnection.HTTP_BAD_REQUEST -> {
                        val fieldErrors = parseValidationErrors(responseBody)
                        val message = parseErrorMessage(responseBody) ?: "Invalid profile input."
                        ApiResponse.ValidationError(fieldErrors, message)
                    }
                    HttpURLConnection.HTTP_CONFLICT -> {
                        val message = parseErrorMessage(responseBody) ?: "Email is already in use."
                        ApiResponse.Conflict(message)
                    }
                    HttpURLConnection.HTTP_UNAUTHORIZED -> {
                        val message = parseErrorMessage(responseBody) ?: "Session expired. Please sign in again."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Update failed (HTTP $responseCode)"
                        ApiResponse.ServerError(message, responseCode)
                    }
                }

                postResult(result, callback)

            } catch (e: Exception) {
                Log.e(TAG, "updateProsumerProfile connection failure", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    fun requestDeactivation(
        token: String,
        callback: (ApiResponse<com.example.smartsolarmicrogrid.data.remote.dto.UserProfileDto>) -> Unit
    ) {
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                val endpointUrl = URL("${baseUrl}api/prosumer/deactivation-request")
                connection = (endpointUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                    doOutput = true
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                    setFixedLengthStreamingMode(0)
                }

                val responseCode = connection.responseCode
                val responseBody = readStream(
                    if (responseCode in 200..299) connection.inputStream else connection.errorStream
                )

                Log.d(TAG, "requestDeactivation status: $responseCode, response: $responseBody")

                val result = when (responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val profile = com.example.smartsolarmicrogrid.data.remote.dto.UserProfileDto.fromJson(responseBody)
                        ApiResponse.Success(profile, responseCode)
                    }
                    HttpURLConnection.HTTP_CONFLICT -> {
                        val message = parseErrorMessage(responseBody)
                            ?: "Account is not active or deactivation was already requested."
                        ApiResponse.Conflict(message)
                    }
                    HttpURLConnection.HTTP_UNAUTHORIZED -> {
                        val message = parseErrorMessage(responseBody) ?: "Session expired. Please sign in again."
                        ApiResponse.ServerError(message, responseCode)
                    }
                    else -> {
                        val message = parseErrorMessage(responseBody) ?: "Deactivation request failed (HTTP $responseCode)"
                        ApiResponse.ServerError(message, responseCode)
                    }
                }

                postResult(result, callback)

            } catch (e: Exception) {
                Log.e(TAG, "requestDeactivation connection failure", e)
                postResult(ApiResponse.NetworkFailure(e), callback)
            } finally {
                connection?.disconnect()
            }
        }
    }

    private fun readStream(inputStream: java.io.InputStream?): String {
        if (inputStream == null) return ""
        return BufferedReader(InputStreamReader(inputStream, Charsets.UTF_8)).use { reader ->
            reader.readText()
        }
    }

    private fun parseValidationErrors(jsonStr: String): Map<String, String> {
        val fieldErrors = mutableMapOf<String, String>()
        try {
            val json = JSONObject(jsonStr)
            if (json.has("errors")) {
                val errorsObj = json.getJSONObject("errors")
                val keys = errorsObj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val messagesArray = errorsObj.optJSONArray(key)
                    if (messagesArray != null && messagesArray.length() > 0) {
                        fieldErrors[key] = messagesArray.getString(0)
                    } else {
                        fieldErrors[key] = errorsObj.optString(key)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing validation problem details", e)
        }
        return fieldErrors
    }

    private fun parseErrorMessage(jsonStr: String): String? {
        return try {
            val json = JSONObject(jsonStr)
            when {
                json.has("message") -> json.getString("message")
                json.has("title") -> json.getString("title")
                json.has("detail") -> json.getString("detail")
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
        private const val TAG = "AuthApiClient"
        const val DEFAULT_BASE_URL = "http://localhost:5127/"
        private const val CONNECT_TIMEOUT_MS = 10000
        private const val READ_TIMEOUT_MS = 10000
    }
}
