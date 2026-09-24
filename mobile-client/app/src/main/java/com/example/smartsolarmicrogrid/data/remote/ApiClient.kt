package com.example.smartsolarmicrogrid.data.remote

import com.example.smartsolarmicrogrid.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Builds the single Retrofit instance used by the app.
 *
 * Creating Retrofit/OkHttp is expensive (thread pools, connection pool), so one
 * instance is shared rather than built per request.
 */
object ApiClient {

    /**
     * The station endpoints sit behind [Authorize]. Until Member 1's JWT scheme
     * exists, the backend accepts a development header identifying the caller.
     *
     * When real authentication lands, replace the two debug headers with:
     *     addHeader("Authorization", "Bearer $token")
     */
    private const val DEBUG_ROLE_HEADER = "X-Debug-Role"
    private const val DEBUG_USER_ID_HEADER = "X-Debug-UserId"
    private const val DEBUG_ROLE = "Prosumer"
    private const val DEBUG_USER_ID = "mobile-user"

    private val authInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .addHeader(DEBUG_ROLE_HEADER, DEBUG_ROLE)
            .addHeader(DEBUG_USER_ID_HEADER, DEBUG_USER_ID)
            .build()
        chain.proceed(request)
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        // Bodies are logged in debug builds only; a release build must not
        // write API payloads into logcat.
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    val stationApi: StationApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(StationApiService::class.java)
    }
}
