package com.beauty4you.admin.data.remote

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

// Формы ответов — 1-в-1 с бэкендом (проверено живыми запросами): записи отдаются без вложенных
// relations, только *Id, имена подтягиваются на устройстве из справочников (как в веб-CRM).

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginResponse(val accessToken: String)

@Serializable
data class MeDto(
    val id: String,
    val email: String,
    val role: String,
    val salonId: String,
    val masterId: String? = null,
)

@Serializable
data class BookingDto(
    val id: String,
    val clientId: String,
    val masterId: String,
    val serviceId: String,
    val startTime: String,
    val endTime: String,
    val status: String,
    val source: String = "ADMIN",
)

@Serializable
data class StaffServiceDto(val id: String)

// GET /staff — сервис уплощает связи: services — массив Service, specializations —
// specializationCategoryIds (см. StaffService.toMasterDetail)
@Serializable
data class StaffDto(
    val id: String,
    val name: String,
    val photo: String? = null,
    val isActive: Boolean = true,
    val services: List<StaffServiceDto> = emptyList(),
    val specializationCategoryIds: List<String> = emptyList(),
)

@Serializable
data class ServiceDto(
    val id: String,
    val name: String,
    val categoryId: String,
    val durationMin: Int,
    // Prisma Decimal сериализуется строкой ("150.00"); JsonElement — на случай числа
    val price: JsonElement = JsonPrimitive("0"),
)

@Serializable
data class CategoryDto(val id: String, val name: String)

@Serializable
data class ClientDto(
    val id: String,
    val name: String,
    val phone: String,
    val email: String? = null,
    val noShowCount: Int = 0,
    val unreliable: Boolean = false,
)

@Serializable
data class CreateClientRequest(
    val name: String,
    val phone: String,
    val consentGiven: Boolean,
)

@Serializable
data class CreateBookingRequest(
    val clientId: String,
    val masterId: String,
    val serviceId: String,
    val startTime: String,
)

@Serializable
data class RescheduleRequest(val startTime: String, val masterId: String? = null)

@Serializable
data class StatusRequest(val status: String)

@Serializable
data class MasterBlockDto(
    val id: String,
    val masterId: String,
    val startTime: String,
    val endTime: String,
    val reason: String? = null,
)

@Serializable
data class ScheduleDayDto(
    val masterId: String,
    val date: String,
    val isWorking: Boolean,
    val startTime: String? = null,
    val endTime: String? = null,
)

@Serializable
data class SlotDto(val startTime: String, val endTime: String)

@Serializable
data class SlotsResponse(val isWorkingDay: Boolean = true, val slots: List<SlotDto> = emptyList())

@Serializable
data class CountDto(val count: Int)

// Новости салона (item75): category NOWOSC|DIGEST|INSPIRACJA, status DRAFT|PUBLISHED
@Serializable
data class NewsPostDto(
    val id: String,
    val category: String,
    val title: String,
    val body: String,
    val imageUrl: String? = null,
    val status: String,
    val publishedAt: String? = null,
    val createdAt: String,
)

// POST /news и PATCH /news/:id; в PATCH null-поля не отправляются (explicitNulls = false)
@Serializable
data class NewsBody(
    val category: String? = null,
    val title: String? = null,
    val body: String? = null,
    val status: String? = null,
)

@Serializable
data class NewsImageBody(val image: String)
