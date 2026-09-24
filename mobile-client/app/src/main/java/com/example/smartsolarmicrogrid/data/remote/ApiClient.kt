package com.example.smartsolarmicrogrid.data.remote

import android.content.Context
import com.example.smartsolarmicrogrid.BuildConfig
import com.example.smartsolarmicrogrid.data.local.TokenManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Builds the single Retrofit instance used by the station endpoints.
 *
 * Creating Retrofit/OkHttp is expensive (thread pools, connection pool), so one
 * instance is shared rather than built per request.
 *
 * [init] must be called once before [stationApi] is used - the application
 * class or the first activity is the right place - because the auth
 * interceptor needs a Context to read the stored token.
 */
object ApiClient {

    private lateinit var tokenManager: TokenManager

    fun init(context: Context) {
        if (!::tokenManager.isInitialized) {
            tokenManager = TokenManager(context.applicationContext)
        }
    }

    /**
     * Every station endpoint sits behind [Authorize], so each request carries
     * the JWT issued by the login endpoint. The header is omitted entirely
     * when no token is stored, which lets the API answer 401 rather than the
     * app sending "Bearer null".
     */
    private val authInterceptor = Interceptor { chain ->
        val token = if (::tokenManager.isInitialized) tokenManager.getToken() else null

        val request = if (token.isNullOrBlank()) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        }

        chain.proceed(request)
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        // Bodies are logged in debug builds only; a release build must not
        // write API payloads - or bearer tokens - into logcat.
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }.apply {
        redactHeader("Authorization")
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
