package com.beauty4you.admin.data.remote

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import retrofit2.HttpException

// Ошибка API: httpCode == null — сеть/сервер недоступен
data class ApiFailure(val httpCode: Int?, val message: String?)

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

fun Throwable.toApiFailure(): ApiFailure = when (this) {
    is HttpException -> ApiFailure(code(), parseNestErrorMessage(response()?.errorBody()?.string()))
    else -> ApiFailure(null, message)
}
