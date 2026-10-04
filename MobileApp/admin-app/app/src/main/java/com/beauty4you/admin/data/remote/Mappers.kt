package com.beauty4you.admin.data.remote

import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.BookingSource
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.domain.Category
import com.beauty4you.admin.domain.Client
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.MasterBlock
import com.beauty4you.admin.domain.ScheduleDay
import com.beauty4you.admin.domain.Service
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset

// ВАЖНО: бэкенд хранит время записи как "время салона, записанное с меткой UTC" (MVP без
// per-salon таймзоны, см. master-app Appointment.kt и frontend dateUtils.ts). Цифры читаются
// как есть, БЕЗ перевода в часовой пояс устройства — иначе в Europe/Warsaw всё сдвинулось бы
// на +1/+2 ч относительно веб-CRM.
fun parseSalonTime(iso: String): LocalDateTime = LocalDateTime.ofInstant(Instant.parse(iso), ZoneOffset.UTC)

// Статус, которого нет в этой версии приложения (например добавленный бэкендом позже), даёт
// null — такая запись не показывается, а не отображается под чужим статусом.
fun BookingDto.toDomain(): Booking? {
    val status = BookingStatus.entries.find { it.name == status } ?: return null
    return Booking(
        id = id,
        clientId = clientId,
        masterId = masterId,
        serviceId = serviceId,
        start = parseSalonTime(startTime),
        end = parseSalonTime(endTime),
        status = status,
        source = if (source == "ONLINE") BookingSource.ONLINE else BookingSource.ADMIN,
    )
}

fun StaffDto.toDomain() = Master(
    id = id,
    name = name,
    photo = photo,
    isActive = isActive,
    serviceIds = services.map { it.id }.toSet(),
    categoryIds = specializationCategoryIds,
)

fun ServiceDto.toDomain() = Service(
    id = id,
    name = name,
    categoryId = categoryId,
    durationMin = durationMin,
    price = (price as? JsonPrimitive)?.content ?: price.toString(),
)

fun CategoryDto.toDomain() = Category(id = id, name = name)

fun ClientDto.toDomain() = Client(
    id = id,
    name = name,
    phone = phone,
    email = email,
    noShowCount = noShowCount,
    unreliable = unreliable,
)

fun MasterBlockDto.toDomain() = MasterBlock(
    id = id,
    masterId = masterId,
    start = parseSalonTime(startTime),
    end = parseSalonTime(endTime),
    reason = reason,
)

// date приходит как "2026-10-05T00:00:00.000Z" (date-only колонка), часы — "HH:mm"
fun ScheduleDayDto.toDomain() = ScheduleDay(
    masterId = masterId,
    date = LocalDate.parse(date.substring(0, 10)),
    isWorking = isWorking,
    startTime = startTime?.let { runCatching { LocalTime.parse(it) }.getOrNull() },
    endTime = endTime?.let { runCatching { LocalTime.parse(it) }.getOrNull() },
)
