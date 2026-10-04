package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.LocalDateTime

internal val DAY: LocalDate = LocalDate.of(2026, 10, 6) // wtorek

internal fun at(hour: Int, minute: Int = 0, date: LocalDate = DAY): LocalDateTime = date.atTime(hour, minute)

internal fun booking(
    id: String,
    start: LocalDateTime,
    minutes: Long = 60,
    masterId: String = "m1",
    clientId: String = "c1",
    serviceId: String = "s1",
    status: BookingStatus = BookingStatus.CONFIRMED,
) = Booking(
    id = id,
    clientId = clientId,
    masterId = masterId,
    serviceId = serviceId,
    start = start,
    end = start.plusMinutes(minutes),
    status = status,
)
