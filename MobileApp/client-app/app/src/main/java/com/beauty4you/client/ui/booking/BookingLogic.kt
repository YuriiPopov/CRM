package com.beauty4you.client.ui.booking

import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.DaySlots
import com.beauty4you.client.data.Master
import com.beauty4you.client.data.Service
import com.beauty4you.client.ui.BookingDraft
import com.beauty4you.client.ui.WeekSlots
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

// Чистая логика экрана записи (без Android/корутин) — покрыта BookingLogicTest.

fun weekStartOf(date: LocalDate): LocalDate = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))

fun weekDays(weekStart: LocalDate): List<LocalDate> = (0L..6L).map(weekStart::plusDays)

/** Назад дальше текущей недели не листается. */
fun canGoToPreviousWeek(weekStart: LocalDate, today: LocalDate): Boolean = weekStart.isAfter(weekStartOf(today))

/** Прошедшие дни и выходные мастера (isWorkingDay = false) неактивны. Пока слоты не загружены — решает только дата. */
fun isDaySelectable(day: LocalDate, today: LocalDate, week: WeekSlots?): Boolean {
    if (day.isBefore(today)) return false
    val info = (week as? WeekSlots.Ready)?.days?.get(day) ?: return true
    return info.isWorkingDay
}

/** Услуги на экране — по категориям, как во вкладке «Usługi»; при входе из карточки мастера — только его услуги. */
fun bookableServices(catalog: Catalog, narrowToMasterId: String?): List<Service> {
    val categoryOrder = catalog.categories.withIndex().associate { (i, c) -> c.id to i }
    val master = narrowToMasterId?.let(catalog::master)
    return catalog.services
        .filter { master == null || it.id in master.serviceIds }
        .sortedBy { categoryOrder[it.categoryId] ?: Int.MAX_VALUE }
}

/** Мастера, оказывающие выбранную услугу; без услуги — только мастер из карточки, если вход был оттуда. */
fun bookableMasters(catalog: Catalog, serviceId: String?, narrowToMasterId: String?): List<Master> = when {
    serviceId != null -> catalog.mastersFor(serviceId)
    else -> listOfNotNull(narrowToMasterId?.let(catalog::master))
}

/**
 * Черновик при открытии экрана. [fromMaster] — вход из карточки мастера: мастер предвыбран, услуги сужены
 * до его услуг. Единственная доступная услуга/мастер выбираются сразу.
 */
fun newBookingDraft(
    catalog: Catalog,
    serviceId: String?,
    masterId: String?,
    fromMaster: Boolean,
    today: LocalDate,
): BookingDraft {
    val knownMasterId = masterId?.takeIf { catalog.master(it) != null }
    val narrowTo = if (fromMaster) knownMasterId else null
    val services = bookableServices(catalog, narrowTo)
    val service = serviceId?.takeIf { id -> services.any { it.id == id } } ?: services.singleOrNull()?.id
    val base = BookingDraft(
        serviceId = null,
        masterId = knownMasterId,
        narrowToMasterId = narrowTo,
        weekStart = weekStartOf(today),
    )
    return if (service != null) base.withService(catalog, service) else base
}

/** Смена услуги: мастер сохраняется, если оказывает её, иначе — единственный подходящий или никто. Время сбрасывается. */
fun BookingDraft.withService(catalog: Catalog, serviceId: String): BookingDraft {
    val masters = catalog.mastersFor(serviceId)
    val keepMaster = masterId?.takeIf { id -> masters.any { it.id == id } }
    return copy(
        serviceId = serviceId,
        masterId = keepMaster ?: masters.singleOrNull()?.id,
        week = null,
        selectedSlot = null,
    )
}

fun BookingDraft.withMaster(masterId: String): BookingDraft =
    copy(masterId = masterId, week = null, selectedSlot = null)

fun BookingDraft.withDate(date: LocalDate): BookingDraft = copy(date = date, selectedSlot = null)

/** Переход на другую неделю: день и время выбираются заново после загрузки слотов. */
fun BookingDraft.withWeek(weekStart: LocalDate): BookingDraft =
    copy(weekStart = weekStart, date = null, week = null, selectedSlot = null)

/** Слоты можно запрашивать только для конкретной пары мастер + услуга. */
val BookingDraft.canLoadSlots: Boolean get() = serviceId != null && masterId != null

val BookingDraft.canConfirm: Boolean
    get() = serviceId != null && masterId != null && date != null && selectedSlot != null && !submitting

/**
 * День после загрузки недели: текущий выбор сохраняется, если он ещё доступен; иначе — первый день
 * со свободными слотами, затем первый рабочий день.
 */
fun pickDate(current: LocalDate?, days: Map<LocalDate, DaySlots>, today: LocalDate): LocalDate? {
    val week = WeekSlots.Ready(days)
    if (current != null && days.containsKey(current) && isDaySelectable(current, today, week)) return current
    val candidates = days.keys.sorted().filter { isDaySelectable(it, today, week) }
    return candidates.firstOrNull { days.getValue(it).slots.isNotEmpty() } ?: candidates.firstOrNull()
}
