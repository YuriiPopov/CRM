package com.beauty4you.admin.domain

import java.time.DayOfWeek
import java.time.LocalDate

// Фильтры календаря: null = «Wszyscy» / «Wszystkie»
data class CalendarFilter(
    val masterId: String? = null,
    val status: BookingStatus? = null,
)

data class MasterGroup(val master: Master, val bookings: List<Booking>)

object CalendarLogic {

    fun weekStartOf(date: LocalDate): LocalDate = date.with(DayOfWeek.MONDAY)

    fun weekDates(weekStart: LocalDate): List<LocalDate> = (0L..6L).map { weekStart.plusDays(it) }

    // Записи выбранного дня под фильтрами, по времени начала (виды Lista и Specjalista)
    fun filterBookings(bookings: List<Booking>, filter: CalendarFilter, date: LocalDate): List<Booking> =
        bookings
            .asSequence()
            .filter { it.date == date }
            .filter { filter.masterId == null || it.masterId == filter.masterId }
            .filter { filter.status == null || it.status == filter.status }
            .sortedBy { it.start }
            .toList()

    // Timeline: отменённые и неявки (NO_SHOW, item74) освобождают время и только загромождали бы
    // сетку (как и таймлайн дашборда веб-CRM), поэтому скрыты — кроме случая, когда их явно
    // запросили фильтром «Status: Odwołana» / «Status: Nieobecna».
    private val SLOT_FREEING_STATUSES = setOf(BookingStatus.CANCELLED, BookingStatus.NO_SHOW)

    fun timelineBookings(bookings: List<Booking>, filter: CalendarFilter, date: LocalDate): List<Booking> =
        filterBookings(bookings, filter, date).filter {
            filter.status == it.status || it.status !in SLOT_FREEING_STATUSES
        }

    // Группы вида Specjalista в порядке списка мастеров; мастера без записей не показываются.
    // Запись мастера, которого нет в списке (удалён/недоступен), не теряется — уходит в группу
    // с именем-заглушкой.
    fun groupByMaster(bookings: List<Booking>, masters: List<Master>): List<MasterGroup> {
        val byMaster = bookings.groupBy { it.masterId }
        val known = masters.mapNotNull { master ->
            byMaster[master.id]?.let { MasterGroup(master, it.sortedBy { b -> b.start }) }
        }
        val knownIds = masters.map { it.id }.toSet()
        val unknown = byMaster
            .filterKeys { it !in knownIds }
            .map { (id, items) -> MasterGroup(Master(id = id, name = "—"), items.sortedBy { it.start }) }
        return known + unknown
    }

    // Колонки Timeline: выбранный фильтром мастер, иначе все активные + неактивные, у которых
    // в этот день всё же есть записи (иначе их записи пропали бы с сетки). Порядок — по имени.
    fun timelineMasters(masters: List<Master>, filter: CalendarFilter, dayBookings: List<Booking>): List<Master> {
        if (filter.masterId != null) {
            return masters.filter { it.id == filter.masterId }
        }
        val withBookings = dayBookings.map { it.masterId }.toSet()
        return masters
            .filter { it.isActive || it.id in withBookings }
            .sortedBy { it.name.lowercase() }
    }
}
