package com.beauty4you.admin.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "admin_session")

class SessionDataStore(private val context: Context) {

    private val tokenKey = stringPreferencesKey("access_token")
    private val emailKey = stringPreferencesKey("email")

    val accessToken: Flow<String?> = context.dataStore.data.map { it[tokenKey] }
    val email: Flow<String?> = context.dataStore.data.map { it[emailKey] }

    suspend fun currentToken(): String? = accessToken.first()

    suspend fun save(accessToken: String, email: String?) {
        context.dataStore.edit { prefs ->
            prefs[tokenKey] = accessToken
            if (email != null) prefs[emailKey] = email else prefs.remove(emailKey)
        }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
