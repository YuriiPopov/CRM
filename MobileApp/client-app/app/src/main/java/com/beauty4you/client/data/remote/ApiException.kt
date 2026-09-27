package com.beauty4you.client.data.remote

import retrofit2.HttpException
import java.io.IOException

/** Ошибка вызова API, сведённая к тому, что важно UI. */
class ApiException(val kind: Kind, val code: String? = null, cause: Throwable? = null) :
    Exception(kind.name, cause) {

    enum class Kind { NETWORK, UNAUTHORIZED, NOT_FOUND, CONFLICT, UNPROCESSABLE, TOO_MANY_REQUESTS, OTHER }
}

/** Выполняет вызов Retrofit, переводя сетевые/HTTP-ошибки в [ApiException]. */
suspend fun <T> apiCall(block: suspend () -> T): T = try {
    block()
} catch (e: HttpException) {
    val body = e.response()?.errorBody()?.string()
    val code = body?.let { runCatching { ApiJson.decodeFromString<ErrorBody>(it).code }.getOrNull() }
    val kind = when (e.code()) {
        401 -> ApiException.Kind.UNAUTHORIZED
        404 -> ApiException.Kind.NOT_FOUND
        409 -> ApiException.Kind.CONFLICT
        422 -> ApiException.Kind.UNPROCESSABLE
        429 -> ApiException.Kind.TOO_MANY_REQUESTS
        else -> ApiException.Kind.OTHER
    }
    throw ApiException(kind, code, e)
} catch (e: IOException) {
    throw ApiException(ApiException.Kind.NETWORK, cause = e)
}
