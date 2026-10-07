package com.beauty4you.admin.data.remote

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.Interceptor
import okhttp3.Response

// Версия клиентского API (item78): уходит в заголовке X-Client-Api на каждый запрос. Backend
// отвечает 426 CLIENT_UPDATE_REQUIRED, когда его MIN_CLIENT_API выше — тогда показывается
// полноэкранное «Dostępna nowa wersja». Единственное место, где живёт номер версии.
object ClientApiVersion {
    const val HEADER = "X-Client-Api"
    const val VERSION = 2
    const val UPDATE_REQUIRED_CODE = "CLIENT_UPDATE_REQUIRED"
}

// Процессный флаг «нужно обновить приложение»: его читает корневой экран
object UpdateRequired {
    private val _required = MutableStateFlow(false)
    val required: StateFlow<Boolean> = _required.asStateFlow()

    fun mark() {
        _required.value = true
    }
}

// Добавляет заголовок версии и отдельно ловит 426: это не 401 (сессию не трогаем) и не сетевая
// ошибка. Статус 426 без кода CLIENT_UPDATE_REQUIRED (например, от прокси) за обновление не считается.
class ClientApiInterceptor(
    private val onUpdateRequired: () -> Unit = UpdateRequired::mark,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .header(ClientApiVersion.HEADER, ClientApiVersion.VERSION.toString())
            .build()
        val response = chain.proceed(request)
        if (response.code == 426 && response.peekBody(PEEK_LIMIT).string().contains(ClientApiVersion.UPDATE_REQUIRED_CODE)) {
            onUpdateRequired()
        }
        return response
    }

    private companion object {
        const val PEEK_LIMIT = 4096L
    }
}
