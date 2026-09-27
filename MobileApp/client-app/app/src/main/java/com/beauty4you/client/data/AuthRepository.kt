package com.beauty4you.client.data

import com.beauty4you.client.data.local.SessionStore
import com.beauty4you.client.data.remote.ApiException
import com.beauty4you.client.data.remote.ClientApi
import com.beauty4you.client.data.remote.RequestCodeBody
import com.beauty4you.client.data.remote.VerifyCodeBody
import com.beauty4you.client.data.remote.apiCall
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

data class CodeRequest(val phone: String, val devCode: String?)

sealed interface VerifyOutcome {
    data object LoggedIn : VerifyOutcome

    /** Код верный, но клиента с таким телефоном в салоне ещё нет — нужны имя и согласие. */
    data object ProfileRequired : VerifyOutcome
}

class AuthRepository(private val api: ClientApi, private val session: SessionStore) {

    val isLoggedIn: Flow<Boolean> = session.accessToken.map { it != null }

    suspend fun requestCode(phone: String): CodeRequest {
        val response = apiCall { api.requestCode(RequestCodeBody(phone)) }
        return CodeRequest(phone = response.phone, devCode = response.devCode)
    }

    suspend fun verify(
        phone: String,
        code: String,
        name: String? = null,
        email: String? = null,
        consentGiven: Boolean? = null,
    ): VerifyOutcome = try {
        val response = apiCall { api.verify(VerifyCodeBody(phone, code, name, email, consentGiven)) }
        session.save(response.accessToken)
        VerifyOutcome.LoggedIn
    } catch (e: ApiException) {
        if (e.code == "PROFILE_REQUIRED") VerifyOutcome.ProfileRequired else throw e
    }

    suspend fun logout() = session.clear()
}
