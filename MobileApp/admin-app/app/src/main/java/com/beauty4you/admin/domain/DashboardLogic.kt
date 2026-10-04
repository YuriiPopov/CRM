package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.LocalDateTime

// Метки мастеров на одном дне полосы «Tydzień»: по одной на запись, в порядке времени
data class DayMarkers(val date: LocalDate, val masterIds: List<String>, val overflow: Int)

object DashboardLogic {

    const val UPCOMING_LIMIT = 3
    const val MAX_MARKERS_PER_DAY = 5

    private val UPCOMING_STATUSES = setOf(BookingStatus.CREATED, BookingStatus.CONFIRMED)

    // «Dzisiaj»: отменённые не требуют внимания сегодня (как на дашборде веб-CRM)
    fun todayBookings(bookings: List<Booking>, today: LocalDate): List<Booking> =
        bookings
            .filter { it.date == today && it.status != BookingStatus.CANCELLED }
            .sortedBy { it.start }

    // «Najbliższe wizyty»: ещё не начавшиеся и не закрытые
    fun upcomingBookings(
        bookings: List<Booking>,
        now: LocalDateTime,
        limit: Int = UPCOMING_LIMIT,
    ): List<Booking> =
        bookings
            .filter { it.status in UPCOMING_STATUSES && !it.start.isBefore(now) }
            .sortedBy { it.start }
            .take(limit)

    fun weekMarkers(
        bookings: List<Booking>,
        weekStart: LocalDate,
        maxPerDay: Int = MAX_MARKERS_PER_DAY,
    ): List<DayMarkers> {
        val active = bookings.filter { it.status != BookingStatus.CANCELLED }.groupBy { it.date }
        return CalendarLogic.weekDates(weekStart).map { date ->
            val masterIds = active[date].orEmpty().sortedBy { it.start }.map { it.masterId }
            DayMarkers(
                date = date,
                masterIds = masterIds.take(maxPerDay),
                overflow = (masterIds.size - maxPerDay).coerceAtLeast(0),
            )
        }
    }

    // Куда вести по тапу «Czekają na potwierdzenie»: день ближайшей неподтверждённой записи
    // (календарь показывает один день, а онлайн-записи разбросаны по будущим датам)
    fun earliestPendingDate(bookings: List<Booking>, now: LocalDateTime): LocalDate? =
        bookings
            .filter { it.status == BookingStatus.CREATED && !it.start.isBefore(now) }
            .minByOrNull { it.start }
            ?.date

    fun todayCountByMaster(bookings: List<Booking>, today: LocalDate): Map<String, Int> =
        todayBookings(bookings, today).groupingBy { it.masterId }.eachCount()
}
