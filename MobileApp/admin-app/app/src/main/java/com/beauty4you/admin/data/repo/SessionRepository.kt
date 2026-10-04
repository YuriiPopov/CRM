package com.beauty4you.admin.data.repo

import com.beauty4you.admin.data.local.SessionDataStore
import com.beauty4you.admin.data.remote.ApiService
import com.beauty4you.admin.data.remote.LoginRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

// Вход сотрудника с ролью, отличной от ADMIN (например мастера)
class NotAdminException : Exception("Not an admin account")

class SessionRepository(
    private val api: ApiService,
    private val session: SessionDataStore,
) {
    val isLoggedIn: Flow<Boolean> = session.accessToken.map { it != null }
    val email: Flow<String?> = session.email

    suspend fun login(email: String, password: String) {
        val response = api.login(LoginRequest(email = email, password = password))
        // Токен нужен для /auth/me; роль проверяем по ответу сервера, а не декодируя JWT
        session.save(accessToken = response.accessToken, email = null)
        val me = runCatching { api.me() }.getOrElse {
            session.clear()
            throw it
        }
        if (me.role != "ADMIN") {
            session.clear()
            throw NotAdminException()
        }
        session.save(accessToken = response.accessToken, email = me.email)
    }

    suspend fun logout() {
        session.clear()
    }
}
