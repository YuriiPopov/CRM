package com.beauty4you.master.data.model

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginResponse(val accessToken: String)

@Serializable
data class AuthenticatedUserDto(
    val id: String,
    val email: String,
    val role: String,
    val salonId: String,
    val masterId: String?,
)

enum class BookingStatus {
    CREATED, CONFIRMED, COMPLETED, CANCELLED
}

// Поля 1-в-1 с backend/prisma/schema.prisma model Booking — сервер отдаёт запись без вложенных
// relations (только *Id), имя клиента/услуги подтягивается на устройстве через ClientsCache/
// ServicesCache (тот же паттерн, что веб-фронтенд использует для Booking — см. frontend/src/types/booking.ts,
// там тоже только id-поля).
@Serializable
data class BookingDto(
    val id: String,
    val salonId: String,
    val clientId: String,
    val masterId: String,
    val serviceId: String,
    val startTime: String,
    val endTime: String,
    val status: BookingStatus,
    val createdAt: String,
)

@Serializable
data class ClientDto(
    val id: String,
    val name: String,
    val phone: String,
    val email: String? = null,
)

@Serializable
data class ServiceDto(
    val id: String,
    val name: String,
    val categoryId: String,
)

// Реальная форма ответа GET /staff/:id (проверено живым curl) отличается от сырого Prisma-include
// в staff.service.ts — контроллер/сервис дополнительно уплощают связи: services — плоский массив
// Service (без обёртки {service: ...}), а specializations превращается в specializationCategoryIds
// (плоский массив id категорий, а не объектов).
@Serializable
data class MasterDetailDto(
    val id: String,
    val name: String,
    val photo: String? = null,
    val services: List<ServiceDto> = emptyList(),
    val specializationCategoryIds: List<String> = emptyList(),
)

@Serializable
data class MasterScheduleDayDto(
    val id: String,
    val masterId: String,
    val date: String,
    val isWorking: Boolean,
    val startTime: String? = null,
    val endTime: String? = null,
)
