package com.beauty4you.admin.domain

import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

// Отрезок на сетке Timeline в минутах от начала окна (09:00). Перевод в dp — в UI.
data class TimelineSpan(val topMinutes: Int, val heightMinutes: Int)

data class TimelineGridLine(val label: String, val topMinutes: Int, val isHour: Boolean)

// Сетка Timeline 09:00–19:00 с шагом 15 минут — то же окно, что у таймлайна веб-CRM
// (frontend/src/pages/dashboard/timeline.ts) и master-app.
object TimelineLayout {
    val WINDOW_START: LocalTime = LocalTime.of(9, 0)
    val WINDOW_END: LocalTime = LocalTime.of(19, 0)
    const val STEP_MINUTES = 15
    const val TOTAL_MINUTES = 10 * 60

    // Минимальная высота блока — одна строка сетки, иначе короткая запись стала бы невидимой
    const val MIN_BLOCK_MINUTES = STEP_MINUTES

    fun gridLines(): List<TimelineGridLine> =
        (0 until TOTAL_MINUTES step STEP_MINUTES).map { offset ->
            val time = WINDOW_START.plusMinutes(offset.toLong())
            val isHour = time.minute == 0
            TimelineGridLine(
                label = if (isHour) PolishDates.time(time) else "%02d".format(time.minute),
                topMinutes = offset,
                isHour = isHour,
            )
        }

    // Раскладка интервала [start, end) на сетке дня day. Сравнение по абсолютному времени, а не
    // по времени суток: многодневная блокировка (отпуск) покрывает весь день, а запись другого
    // дня не попадает на сетку (урок item71). Края прижимаются к окну; интервал целиком вне окна
    // (в т.ч. заканчивающийся ровно в 09:00) — null.
    fun layout(start: LocalDateTime, end: LocalDateTime, day: LocalDate): TimelineSpan? {
        val windowStart = day.atTime(WINDOW_START)
        val windowEnd = day.atTime(WINDOW_END)
        if (!start.isBefore(windowEnd) || !end.isAfter(windowStart)) return null

        val clampedStart = if (start.isBefore(windowStart)) windowStart else start
        val clampedEnd = if (end.isAfter(windowEnd)) windowEnd else end

        val height = minutesBetween(clampedStart, clampedEnd).coerceAtLeast(MIN_BLOCK_MINUTES)
        // Минимальная высота не должна выталкивать блок за нижний край сетки (запись 18:55–19:00)
        val top = minutesBetween(windowStart, clampedStart).coerceAtMost(TOTAL_MINUTES - height)
        return TimelineSpan(topMinutes = top, heightMinutes = height)
    }

    fun layoutBooking(booking: Booking, day: LocalDate): TimelineSpan? = layout(booking.start, booking.end, day)

    fun layoutBlock(block: MasterBlock, day: LocalDate): TimelineSpan? = layout(block.start, block.end, day)

    // Недоступность по графику (серым): выходной — весь день; рабочий день — до начала и после
    // конца смены, обрезано по окну. Нет записи графика или часов — данных для заливки нет.
    fun scheduleUnavailable(schedule: ScheduleDay?): List<TimelineSpan> {
        if (schedule == null) return emptyList()
        if (!schedule.isWorking) return listOf(TimelineSpan(0, TOTAL_MINUTES))
        val start = schedule.startTime ?: return emptyList()
        val end = schedule.endTime ?: return emptyList()

        val startOffset = offsetInWindow(start)
        val endOffset = offsetInWindow(end)
        val spans = mutableListOf<TimelineSpan>()
        if (startOffset > 0) spans += TimelineSpan(0, startOffset)
        if (endOffset < TOTAL_MINUTES) spans += TimelineSpan(endOffset, TOTAL_MINUTES - endOffset)
        return spans
    }

    // Подпись часов работы мастера под его именем в шапке колонки
    fun hoursLabel(schedule: ScheduleDay?): String = when {
        schedule == null -> "—"
        !schedule.isWorking -> "Wolne"
        schedule.startTime != null && schedule.endTime != null ->
            "${PolishDates.time(schedule.startTime)}–${PolishDates.time(schedule.endTime)}"
        else -> "—"
    }

    private fun offsetInWindow(time: LocalTime): Int =
        Duration.between(WINDOW_START, time).toMinutes().toInt().coerceIn(0, TOTAL_MINUTES)

    private fun minutesBetween(from: LocalDateTime, to: LocalDateTime): Int =
        Duration.between(from, to).toMinutes().toInt()
}
