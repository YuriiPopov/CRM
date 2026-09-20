package com.beauty4you.master.data.repo

import com.beauty4you.master.data.model.BookingStatus
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset

// Модель записи для UI, уже обогащённая именем клиента/услуги (см. CatalogRepository) и
// разобранная на дату/время. ВАЖНО: бэкенд хранит startTime/endTime как "salon-local время,
// записанное с меткой UTC" — это осознанное MVP-упрощение без per-salon таймзоны (см. коммент в
// frontend/src/pages/calendar/dateUtils.ts: "09:00" на экране должно совпадать с тем, что реально
// хранится/проверяется на бэкенде). Веб-фронтенд поэтому всегда форматирует с timeZone: 'UTC',
// игнорируя таймзону браузера — здесь по той же причине читаем цифры как есть, БЕЗ конвертации
// в часовой пояс устройства (было: ZoneId.systemDefault() — на устройстве в Europe/Warsaw это
// сдвигало каждое время на +1/+2ч и выбрасывало записи за пределы окна таймлайна 09:00–19:00).
data class Appointment(
    val id: String,
    val serviceName: String,
    val clientName: String,
    val status: BookingStatus,
    val start: LocalDateTime,
    val end: LocalDateTime,
) {
    val date: LocalDate get() = start.toLocalDate()
    val startTime: LocalTime get() = start.toLocalTime()
    val endTime: LocalTime get() = end.toLocalTime()

    companion object {
        fun parseInstant(iso: String): LocalDateTime =
            LocalDateTime.ofInstant(Instant.parse(iso), ZoneOffset.UTC)
    }
}
