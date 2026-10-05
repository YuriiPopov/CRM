package com.beauty4you.client.data.remote

import kotlinx.serialization.Serializable

// DTO эндпоинтов /client/* (backend/src/client-portal). Даты — ISO-строки: бэкенд хранит
// "время салона с меткой UTC", разбор — в Mappers.kt.

@Serializable
data class RequestCodeBody(val phone: String)

@Serializable
data class RequestCodeResponse(
    val phone: String,
    val expiresInSec: Int,
    // Только при CLIENT_OTP_DEV_MODE=true на бэкенде (локальная разработка без SMS)
    val devCode: String? = null,
)

@Serializable
data class VerifyCodeBody(
    val phone: String,
    val code: String,
    val name: String? = null,
    val email: String? = null,
    val consentGiven: Boolean? = null,
)

@Serializable
data class VerifyCodeResponse(
    val accessToken: String,
    val client: ClientDto,
    val isNewClient: Boolean,
)

@Serializable
data class ClientDto(
    val id: String,
    val name: String,
    val phone: String,
    val email: String? = null,
)

@Serializable
data class CatalogDto(
    val salon: SalonDto,
    val categories: List<CategoryDto>,
    val services: List<ServiceDto>,
    val masters: List<MasterDto>,
)

@Serializable
data class SalonDto(val name: String, val address: String? = null)

@Serializable
data class CategoryDto(val id: String, val name: String)

@Serializable
data class ServiceDto(
    val id: String,
    val name: String,
    val categoryId: String,
    val durationMin: Int,
    val price: Double,
)

@Serializable
data class MasterDto(
    val id: String,
    val name: String,
    // base64 data URL ("data:image/webp;base64,...") или null
    val photo: String? = null,
    val serviceIds: List<String>,
    val specializations: List<String>,
)

@Serializable
data class SlotsResponse(
    val date: String,
    val isWorkingDay: Boolean,
    val slots: List<SlotDto>,
)

@Serializable
data class SlotDto(val startTime: String, val endTime: String)

@Serializable
data class CreateBookingBody(val masterId: String, val serviceId: String, val startTime: String)

@Serializable
data class BookingDto(
    val id: String,
    val serviceId: String,
    val serviceName: String,
    val masterId: String,
    val masterName: String,
    val startTime: String,
    val endTime: String,
    val status: String,
    val price: Double,
)

/** Тело ошибки NestJS; `code` — только у собственных ошибок client-portal (PROFILE_REQUIRED). */
@Serializable
data class ErrorBody(val statusCode: Int? = null, val code: String? = null)

// GET /client/news — только опубликованные новости салона, новые сверху (item75).
// category: NOWOSC | DIGEST | INSPIRACJA; publishedAt — настоящий момент времени (не «время салона»).
@Serializable
data class NewsDto(
    val id: String,
    val category: String,
    val title: String,
    val body: String,
    // base64 data URL, как фото мастера, или null
    val imageUrl: String? = null,
    val publishedAt: String,
)
