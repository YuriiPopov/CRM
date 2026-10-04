package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

// Доменные модели приложения администратора — без Android-зависимостей, чтобы вся логика
// экранов (фильтры, таймлайн, переходы статусов, даты) проверялась обычными JVM unit-тестами.
//
// Время записей — "время салона, записанное с меткой UTC" (MVP без per-salon таймзоны, как в
// веб-CRM и master-app): ISO-строки бэкенда разбираются в LocalDateTime БЕЗ перевода в
// часовой пояс устройства, см. data/remote/Mappers.kt.

enum class BookingStatus { CREATED, CONFIRMED, COMPLETED, CANCELLED }

enum class BookingSource { ADMIN, ONLINE }

data class Booking(
    val id: String,
    val clientId: String,
    val masterId: String,
    val serviceId: String,
    val start: LocalDateTime,
    val end: LocalDateTime,
    val status: BookingStatus,
    val source: BookingSource = BookingSource.ADMIN,
) {
    val date: LocalDate get() = start.toLocalDate()
}

data class Master(
    val id: String,
    val name: String,
    val photo: String? = null,
    val isActive: Boolean = true,
    val serviceIds: Set<String> = emptySet(),
    val categoryIds: List<String> = emptyList(),
)

data class Service(
    val id: String,
    val name: String,
    val categoryId: String,
    val durationMin: Int,
    // Prisma Decimal приходит строкой ("150.00") — храним как есть, форматирует Formatters.price
    val price: String,
)

data class Category(val id: String, val name: String)

data class Client(
    val id: String,
    val name: String,
    val phone: String,
    val email: String? = null,
)

// Блокировка времени мастера (MasterBlock) — может быть многодневной (отпуск)
data class MasterBlock(
    val id: String,
    val masterId: String,
    val start: LocalDateTime,
    val end: LocalDateTime,
    val reason: String? = null,
)

// День графика мастера (MasterSchedule). Отсутствие записи на дату — "график не настроен",
// а не "недоступен" (семантика бэкенда, см. BookingsService.assertScheduleAllows).
data class ScheduleDay(
    val masterId: String,
    val date: LocalDate,
    val isWorking: Boolean,
    val startTime: LocalTime? = null,
    val endTime: LocalTime? = null,
)
