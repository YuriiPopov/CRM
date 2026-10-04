package com.beauty4you.admin.data.remote

import com.beauty4you.admin.BuildConfig
import com.beauty4you.admin.data.local.SessionDataStore
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit

// OkHttp-интерцепторы синхронные — токен читаем блокирующе (как в master-app).
// 401 на любом запросе, кроме самого логина, означает истёкший/отозванный токен: сессия
// очищается здесь, в одном месте, и MainActivity по isLoggedIn == false возвращает на вход —
// ViewModel'ям не нужно отдельно обрабатывать 401.
class AuthInterceptor(private val session: SessionDataStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { session.currentToken() }
        val request = chain.request().newBuilder().apply {
            if (token != null) addHeader("Authorization", "Bearer $token")
        }.build()
        val response = chain.proceed(request)
        if (response.code == 401 && token != null && !request.url.encodedPath.endsWith("/auth/login")) {
            runBlocking { session.clear() }
        }
        return response
    }
}

object NetworkModule {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }

    fun createApiService(session: SessionDataStore): ApiService {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(session))
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ApiService::class.java)
    }
}
