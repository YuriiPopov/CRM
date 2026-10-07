package com.beauty4you.admin.data.remote

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import retrofit2.HttpException

// Ошибка API: httpCode == null — сеть/сервер недоступен
// code — машинный код ошибки из тела ответа (например, MASTER_HAS_BOOKINGS), если бэкенд его отдал
data class ApiFailure(val httpCode: Int?, val message: String?, val code: String? = null)

private val errorJson = Json { ignoreUnknownKeys = true }

// Тело ошибки Nest: {"message": "..." | ["...", "..."], "error": "...", "statusCode": 409}
fun parseNestErrorMessage(body: String?): String? {
    if (body.isNullOrBlank()) return null
    val root = runCatching { errorJson.parseToJsonElement(body) }.getOrNull() as? JsonObject ?: return null
    return when (val message = root["message"]) {
        is JsonPrimitive -> message.content
        is JsonArray -> message.mapNotNull { (it as? JsonPrimitive)?.content }.joinToString("; ")
        else -> null
    }
}

// Машинный код ошибки: {"code": "MASTER_HAS_BOOKINGS", ...}
fun parseNestErrorCode(body: String?): String? {
    if (body.isNullOrBlank()) return null
    val root = runCatching { errorJson.parseToJsonElement(body) }.getOrNull() as? JsonObject ?: return null
    return (root["code"] as? JsonPrimitive)?.takeIf { it.isString }?.content
}

fun Throwable.toApiFailure(): ApiFailure = when (this) {
    is HttpException -> {
        // errorBody().string() читается один раз — парсим из одной строки
        val body = response()?.errorBody()?.string()
        ApiFailure(code(), parseNestErrorMessage(body), parseNestErrorCode(body))
    }
    else -> ApiFailure(null, message)
}
