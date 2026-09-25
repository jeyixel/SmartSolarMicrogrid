package com.example.smartsolarmicrogrid.data.remote.dto

/**
 * Result wrapper for remote API requests.
 */
sealed class ApiResponse<out T> {
    data class Success<out T>(val data: T, val statusCode: Int) : ApiResponse<T>()
    data class ValidationError(val fieldErrors: Map<String, String>, val rawMessage: String) : ApiResponse<Nothing>()
    data class Conflict(val message: String) : ApiResponse<Nothing>()
    data class ServerError(val message: String, val statusCode: Int) : ApiResponse<Nothing>()
    data class NetworkFailure(val exception: Throwable) : ApiResponse<Nothing>()
}
