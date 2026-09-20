package com.beauty4you.master.data.remote

import com.beauty4you.master.data.local.SessionDataStore
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

// OkHttp-интерцепторы синхронные — токен читаем блокирующе через runBlocking(DataStore.first()),
// как рекомендует сама документация DataStore для интеграции с Interceptor.
class AuthInterceptor(private val session: SessionDataStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { session.currentToken() }
        val request = chain.request().newBuilder().apply {
            if (token != null) {
                addHeader("Authorization", "Bearer $token")
            }
        }.build()
        return chain.proceed(request)
    }
}
