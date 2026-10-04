package com.beauty4you.admin.domain

// Зеркалит конечный автомат статусов бэкенда (ALLOWED_STATUS_TRANSITIONS в
// backend/src/bookings/bookings.service.ts) и веб-CRM (statusTransitions.ts). Бэкенд остаётся
// источником истины — здесь только то, что предлагать в форме.
object BookingStatusRules {

    private val TRANSITIONS: Map<BookingStatus, List<BookingStatus>> = mapOf(
        BookingStatus.CREATED to listOf(BookingStatus.CONFIRMED, BookingStatus.CANCELLED),
        BookingStatus.CONFIRMED to listOf(BookingStatus.COMPLETED, BookingStatus.CANCELLED),
        BookingStatus.COMPLETED to emptyList(),
        BookingStatus.CANCELLED to emptyList(),
    )

    fun allowedTransitions(from: BookingStatus): List<BookingStatus> = TRANSITIONS.getValue(from)

    fun canTransition(from: BookingStatus, to: BookingStatus): Boolean = to in allowedTransitions(from)

    fun isTerminal(status: BookingStatus): Boolean = allowedTransitions(status).isEmpty()

    // PATCH /bookings/:id/reschedule отклоняет COMPLETED и CANCELLED
    fun canReschedule(status: BookingStatus): Boolean = !isTerminal(status)

    // «Usuń» в этапе 1 — это отмена (CANCELLED), а не физическое удаление
    fun canCancel(status: BookingStatus): Boolean = canTransition(status, BookingStatus.CANCELLED)

    // Варианты поля STATUS в форме. Новая запись создаётся бэкендом как CREATED; «Potwierdzona»
    // при создании — это POST + сразу PATCH на CONFIRMED (см. BookingFormLogic.planSave).
    // Отмена в форме не предлагается — для неё есть отдельная кнопка «Usuń» с подтверждением.
    fun formStatusOptions(current: BookingStatus?): List<BookingStatus> =
        if (current == null) {
            listOf(BookingStatus.CREATED, BookingStatus.CONFIRMED)
        } else {
            listOf(current) + allowedTransitions(current).filter { it != BookingStatus.CANCELLED }
        }
}
