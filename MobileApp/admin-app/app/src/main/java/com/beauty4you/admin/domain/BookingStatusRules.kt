package com.beauty4you.admin.domain

import java.time.LocalDateTime

// Зеркалит конечный автомат статусов бэкенда (ALLOWED_STATUS_TRANSITIONS в
// backend/src/bookings/bookings.service.ts) и веб-CRM (statusTransitions.ts). Бэкенд остаётся
// источником истины — здесь только то, что предлагать в форме.
object BookingStatusRules {

    private val TRANSITIONS: Map<BookingStatus, List<BookingStatus>> = mapOf(
        BookingStatus.CREATED to listOf(BookingStatus.CONFIRMED, BookingStatus.CANCELLED),
        BookingStatus.CONFIRMED to listOf(BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW),
        BookingStatus.COMPLETED to emptyList(),
        BookingStatus.CANCELLED to emptyList(),
        BookingStatus.NO_SHOW to emptyList(),
    )

    fun allowedTransitions(from: BookingStatus): List<BookingStatus> = TRANSITIONS.getValue(from)

    fun canTransition(from: BookingStatus, to: BookingStatus): Boolean = to in allowedTransitions(from)

    // «Nieobecna» (item74) — только когда время начала визита уже наступило (иначе бэкенд вернёт 400)
    fun canMarkNoShow(status: BookingStatus, start: LocalDateTime, now: LocalDateTime): Boolean =
        canTransition(status, BookingStatus.NO_SHOW) && !start.isAfter(now)

    fun isTerminal(status: BookingStatus): Boolean = allowedTransitions(status).isEmpty()

    // PATCH /bookings/:id/reschedule отклоняет COMPLETED, CANCELLED и NO_SHOW
    fun canReschedule(status: BookingStatus): Boolean = !isTerminal(status)

    // «Usuń» в этапе 1 — это отмена (CANCELLED), а не физическое удаление
    fun canCancel(status: BookingStatus): Boolean = canTransition(status, BookingStatus.CANCELLED)

    // Варианты поля STATUS в форме. Новая запись создаётся бэкендом как CREATED; «Potwierdzona»
    // при создании — это POST + сразу PATCH на CONFIRMED (см. BookingFormLogic.planSave).
    // Отмена в форме не предлагается — для неё есть отдельная кнопка «Usuń» с подтверждением.
    // «Nieobecna» — только для уже начавшейся записи (см. canMarkNoShow).
    fun formStatusOptions(original: Booking?, now: LocalDateTime): List<BookingStatus> =
        if (original == null) {
            listOf(BookingStatus.CREATED, BookingStatus.CONFIRMED)
        } else {
            listOf(original.status) + allowedTransitions(original.status).filter {
                it != BookingStatus.CANCELLED &&
                    (it != BookingStatus.NO_SHOW || canMarkNoShow(original.status, original.start, now))
            }
        }
}
