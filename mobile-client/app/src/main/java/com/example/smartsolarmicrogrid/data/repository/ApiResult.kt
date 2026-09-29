package com.example.smartsolarmicrogrid.data.repository

/**
 * Outcome of a network call.
 *
 * The repository never throws at its caller: every failure - no connection,
 * timeout, 401, 404, malformed JSON - comes back as [Error] carrying a message
 * fit to show the user. The ViewModel can then render a state rather than
 * wrapping each call in try/catch.
 */
sealed class ApiResult<out T> {
    data class Success<out T>(val data: T) : ApiResult<T>()
    data class Error(val message: String) : ApiResult<Nothing>()
}
