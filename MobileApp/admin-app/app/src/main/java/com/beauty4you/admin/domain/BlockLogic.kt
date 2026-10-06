package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.LocalTime

// Блокировки времени мастера (item76, часть 2): дата, часы с–до, причина. Чистый Kotlin.

// Причина хранится на бэкенде свободной строкой (MasterBlock.reason, до 255 символов) и так же
// показывается в веб-CRM и Timeline — поэтому пишем её читаемым польским текстом:
// «Urlop», «Przerwa», «Inne: <комментарий>» (комментарий допустим и у Urlop/Przerwa).
enum class BlockReason(val stored: String) { URLOP("Urlop"), PRZERWA("Przerwa"), INNE("Inne") }

data class BlockForm(
    val date: LocalDate,
    val start: LocalTime = ScheduleLogic.DEFAULT_START,
    val end: LocalTime = ScheduleLogic.DEFAULT_END,
    val reason: BlockReason = BlockReason.URLOP,
    val comment: String = "",
)

enum class BlockFieldError { DATE_IN_PAST, START_NOT_BEFORE_END, OUT_OF_RANGE, COMMENT_REQUIRED, COMMENT_TOO_LONG }

enum class BlockError { OVERLAPS_BOOKING, OVERLAPS_BLOCK, VALIDATION, NOT_FOUND, NETWORK, UNKNOWN }

object BlockLogic {
    const val REASON_MAX = 255

    // Новая блокировка: по умолчанию весь рабочий день сегодня — «пустая» форма
    fun newForm(today: LocalDate) = BlockForm(date = today)

    fun reasonText(form: BlockForm): String {
        val comment = form.comment.trim()
        return if (comment.isEmpty()) form.reason.stored else "${form.reason.stored}: $comment"
    }

    fun validate(form: BlockForm, today: LocalDate): Set<BlockFieldError> = buildSet {
        if (form.date.isBefore(today)) add(BlockFieldError.DATE_IN_PAST)
        when (ScheduleLogic.validateHours(form.start, form.end)) {
            HoursError.START_NOT_BEFORE_END -> add(BlockFieldError.START_NOT_BEFORE_END)
            HoursError.OUT_OF_RANGE -> add(BlockFieldError.OUT_OF_RANGE)
            null -> Unit
        }
        // «Inne» без пояснения ничего не говорит ни администратору, ни мастеру
        if (form.reason == BlockReason.INNE && form.comment.isBlank()) add(BlockFieldError.COMMENT_REQUIRED)
        if (reasonText(form).length > REASON_MAX) add(BlockFieldError.COMMENT_TOO_LONG)
    }

    fun isDirty(initial: BlockForm, form: BlockForm): Boolean =
        initial.copy(comment = initial.comment.trim()) != form.copy(comment = form.comment.trim())

    // Время в API — «время салона с меткой UTC», как у записей (см. Mappers.parseSalonTime)
    fun toApiDateTime(date: LocalDate, time: LocalTime): String = "${date}T${PolishDates.time(time)}:00.000Z"

    // Будущие блокировки мастера (и сегодняшние) — по началу
    fun upcoming(blocks: List<MasterBlock>, masterId: String, today: LocalDate): List<MasterBlock> =
        blocks.filter { it.masterId == masterId && !it.end.toLocalDate().isBefore(today) }.sortedBy { it.start }

    // Тексты 409/400 — из MasterBlocksService
    fun mapError(httpCode: Int?, message: String?): BlockError {
        val text = message.orEmpty().lowercase()
        return when {
            httpCode == null -> BlockError.NETWORK
            httpCode == 409 && "active bookings" in text -> BlockError.OVERLAPS_BOOKING
            httpCode == 409 && "already blocked" in text -> BlockError.OVERLAPS_BLOCK
            httpCode == 400 -> BlockError.VALIDATION
            httpCode == 404 -> BlockError.NOT_FOUND
            else -> BlockError.UNKNOWN
        }
    }
}
