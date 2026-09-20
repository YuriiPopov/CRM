package com.beauty4you.master.data.repo

import com.beauty4you.master.data.local.SessionDataStore
import com.beauty4you.master.data.model.AuthenticatedUserDto
import com.beauty4you.master.data.model.LoginRequest
import com.beauty4you.master.data.remote.ApiService
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class SessionRepository(
    private val api: ApiService,
    private val session: SessionDataStore,
) {
    val isLoggedIn: Flow<Boolean> = session.accessToken.map { it != null }
    val masterId: Flow<String?> = session.masterId
    val email: Flow<String?> = session.email

    suspend fun login(email: String, password: String) {
        val response = api.login(LoginRequest(email = email, password = password))
        // "me" сразу после логина, чтобы сохранить masterId/email (в JWT они тоже есть, но
        // сервер — источник истины, а не декодирование токена на клиенте).
        session.save(accessToken = response.accessToken, masterId = null)
        val me: AuthenticatedUserDto = api.me()
        session.save(accessToken = response.accessToken, masterId = me.masterId, email = me.email)
    }

    suspend fun logout() {
        session.clear()
    }
}
