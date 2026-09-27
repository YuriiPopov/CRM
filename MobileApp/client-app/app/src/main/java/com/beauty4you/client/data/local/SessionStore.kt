package com.beauty4you.client.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "client_session")

/** JWT клиента (выдаётся /client/auth/verify, живёт CLIENT_JWT_EXPIRES_IN — по умолчанию 30 дней). */
class SessionStore(private val context: Context) {

    private val tokenKey = stringPreferencesKey("access_token")

    val accessToken: Flow<String?> = context.dataStore.data.map { it[tokenKey] }

    suspend fun currentToken(): String? = accessToken.first()

    suspend fun save(accessToken: String) {
        context.dataStore.edit { it[tokenKey] = accessToken }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
