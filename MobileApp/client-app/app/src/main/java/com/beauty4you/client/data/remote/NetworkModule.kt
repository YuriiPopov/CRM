package com.beauty4you.client.data.remote

import com.beauty4you.client.BuildConfig
import com.beauty4you.client.data.local.SessionStore
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

val ApiJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
}

object NetworkModule {

    fun createClientApi(session: SessionStore): ClientApi {
        val logging = HttpLoggingInterceptor().apply {
            // BASIC, а не BODY: в ответах есть JWT и фото мастеров в base64
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(session))
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(ApiJson.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ClientApi::class.java)
    }
}

// OkHttp-интерцепторы синхронные — токен читаем блокирующе (runBlocking над DataStore), как и в
// master-app. 401 на защищённом маршруте = токен истёк или клиент удалён: сбрасываем сессию,
// и корневой экран сам переключается на вход (он подписан на SessionStore.accessToken).
class AuthInterceptor(private val session: SessionStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { session.currentToken() }
        val request = chain.request().newBuilder().apply {
            if (token != null) addHeader("Authorization", "Bearer $token")
        }.build()

        val response = chain.proceed(request)
        val isAuthRoute = request.url.encodedPath.startsWith("/client/auth/")
        if (response.code == 401 && token != null && !isAuthRoute) {
            runBlocking { session.clear() }
        }
        return response
    }
}
