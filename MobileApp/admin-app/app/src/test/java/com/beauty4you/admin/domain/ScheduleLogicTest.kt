package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.YearMonth

class ScheduleLogicTest {

    private fun t(h: Int, m: Int = 0) = LocalTime.of(h, m)
    private fun d(day: Int, month: Int = 10) = LocalDate.of(2026, month, day)
    private val working = DaySchedule(DayStatus.WORKING, t(9), t(19))
    private val off = DaySchedule(DayStatus.OFF)
    private val unset = DaySchedule(DayStatus.UNSET)

    // --- Неделя ---

    @Test
    fun `week starts on monday and has seven days`() {
        // 2026-10-08 — четверг
        assertEquals(d(5), ScheduleLogic.weekStart(d(8)))
        assertEquals(d(5), ScheduleLogic.weekStart(d(5)))
        assertEquals(d(5), ScheduleLogic.weekStart(d(11)))
        assertEquals((5..11).map { d(it) }, ScheduleLogic.weekDates(d(5)))
    }

    @Test
    fun `week crossing a month needs both months`() {
        val week = ScheduleLogic.weekDates(d(28, 9))
        assertEquals(listOf(YearMonth.of(2026, 9), YearMonth.of(2026, 10)), ScheduleLogic.monthsOf(week))
    }

    @Test
    fun `server records become working, off or unset days`() {
        val records = listOf(
            ScheduleDay("m1", d(5), isWorking = true, startTime = t(10), endTime = t(18)),
            ScheduleDay("m1", d(6), isWorking = false),
            ScheduleDay("m1", d(7), isWorking = true), // часы не заданы — часы салона
        )
        val days = ScheduleLogic.fromServer(listOf(d(5), d(6), d(7), d(8)), records)
        assertEquals(DaySchedule(DayStatus.WORKING, t(10), t(18)), days[d(5)])
        assertEquals(DayStatus.OFF, days[d(6)]!!.status)
        assertEquals(DaySchedule(DayStatus.WORKING, t(9), t(19)), days[d(7)])
        assertEquals(DayStatus.UNSET, days[d(8)]!!.status)
    }

    // --- Выбор нескольких дней ---

    @Test
    fun `tapping a day adds or removes it from the selection`() {
        val one = ScheduleLogic.toggleSelection(emptySet(), d(5))
        val two = ScheduleLogic.toggleSelection(one, d(7))
        assertEquals(setOf(d(5), d(7)), two)
        assertEquals(setOf(d(7)), ScheduleLogic.toggleSelection(two, d(5)))
    }

    @Test
    fun `select whole week, and the same tap on a full week clears it`() {
        val week = ScheduleLogic.weekDates(d(5))
        val partial = setOf(d(6), d(1))
        val all = ScheduleLogic.toggleWeek(partial, week)
        assertEquals(week.toSet() + d(1), all)
        // День другой недели остаётся выбранным
        assertEquals(setOf(d(1)), ScheduleLogic.toggleWeek(all, week))
    }

    @Test
    fun `same hours are applied to every selected day and only to them`() {
        val states = mapOf(d(5) to unset, d(6) to off, d(7) to working)
        val custom = DaySchedule(DayStatus.WORKING, t(10), t(16))
        val result = ScheduleLogic.applyToSelected(states, setOf(d(5), d(6)), custom)
        assertEquals(custom, result[d(5)])
        assertEquals(custom, result[d(6)])
        assertEquals(working, result[d(7)])
    }

    // --- Проверка часов ---

    @Test
    fun `hours must go forward and stay within 06-22`() {
        assertNull(ScheduleLogic.validateHours(t(9), t(19)))
        assertNull(ScheduleLogic.validateHours(t(6), t(22)))
        assertEquals(HoursError.START_NOT_BEFORE_END, ScheduleLogic.validateHours(t(19), t(9)))
        assertEquals(HoursError.START_NOT_BEFORE_END, ScheduleLogic.validateHours(t(10), t(10)))
        assertEquals(HoursError.OUT_OF_RANGE, ScheduleLogic.validateHours(t(5, 45), t(12)))
        assertEquals(HoursError.OUT_OF_RANGE, ScheduleLogic.validateHours(t(12), t(22, 15)))
    }

    @Test
    fun `time options cover 06-22 with a 15 minute step`() {
        val options = ScheduleLogic.timeOptions()
        assertEquals(t(6), options.first())
        assertEquals(t(22), options.last())
        assertEquals(65, options.size)
    }

    // --- Несохранённые изменения и план сохранения ---

    @Test
    fun `untouched schedule is not dirty, any real change is`() {
        val loaded = mapOf(d(5) to working, d(6) to off, d(7) to unset)
        assertFalse(ScheduleLogic.isDirty(loaded, loaded))
        assertTrue(ScheduleLogic.isDirty(loaded, loaded + (d(7) to working)))
        assertTrue(ScheduleLogic.isDirty(loaded, loaded + (d(5) to working.copy(end = t(18)))))
    }

    @Test
    fun `off day with different hidden hours is not a change`() {
        val loaded = mapOf(d(6) to off)
        assertFalse(ScheduleLogic.isDirty(loaded, mapOf(d(6) to DaySchedule(DayStatus.OFF, t(10), t(12)))))
    }

    @Test
    fun `changed days are split per month, sorted, off days without hours`() {
        val loaded = mapOf(d(30, 9) to unset, d(1) to working, d(2) to working)
        val edited = mapOf(
            d(30, 9) to DaySchedule(DayStatus.WORKING, t(10), t(16)),
            d(1) to working, // не изменился
            d(2) to off,
        )
        val plans = ScheduleLogic.planSave(ScheduleLogic.changedDays(loaded, edited))
        assertEquals(
            listOf(
                ScheduleMonthPlan(YearMonth.of(2026, 9), listOf(ScheduleDayInput(d(30, 9), true, t(10), t(16)))),
                ScheduleMonthPlan(YearMonth.of(2026, 10), listOf(ScheduleDayInput(d(2), false))),
            ),
            plans,
        )
    }

    // --- Ответ о конфликтах ---

    @Test
    fun `conflicts are deduplicated, sorted and named from the catalog`() {
        fun booking(id: String, day: Int, hour: Int) = Booking(
            id = id,
            clientId = "c-$id",
            masterId = "m1",
            serviceId = "s1",
            start = LocalDateTime.of(2026, 10, day, hour, 0),
            end = LocalDateTime.of(2026, 10, day, hour + 1, 0),
            status = BookingStatus.CONFIRMED,
        )
        fun conflict(b: Booking, reason: ConflictReason) = BookingConflict(b, reason)
        val response = listOf(
            conflict(booking("b2", 7, 12), ConflictReason.OUTSIDE_HOURS),
            conflict(booking("b1", 6, 15), ConflictReason.DAY_OFF),
            conflict(booking("b2", 7, 12), ConflictReason.OUTSIDE_HOURS),
        )
        val rows = ScheduleLogic.conflicts(response, { "Klient $it" }, { "Manicure" })

        assertEquals(listOf("b1", "b2"), rows.map { it.bookingId })
        assertEquals(ScheduleConflict("b1", d(6), t(15), "Klient c-b1", "Manicure", ConflictReason.DAY_OFF), rows.first())
        assertEquals(ConflictReason.OUTSIDE_HOURS, rows.last().reason)
    }

    @Test
    fun `conflict reason maps from the api string, unknown or missing means day off`() {
        assertEquals(ConflictReason.OUTSIDE_HOURS, ScheduleLogic.conflictReason("OUTSIDE_HOURS"))
        assertEquals(ConflictReason.DAY_OFF, ScheduleLogic.conflictReason("DAY_OFF"))
        assertEquals(ConflictReason.DAY_OFF, ScheduleLogic.conflictReason(null))
        assertEquals(ConflictReason.DAY_OFF, ScheduleLogic.conflictReason("SOMETHING_NEW"))
    }

    @Test
    fun `schedule errors map from http codes`() {
        assertEquals(ScheduleError.NETWORK, ScheduleLogic.mapError(null))
        assertEquals(ScheduleError.VALIDATION, ScheduleLogic.mapError(400))
        assertEquals(ScheduleError.NOT_FOUND, ScheduleLogic.mapError(404))
        assertEquals(ScheduleError.UNKNOWN, ScheduleLogic.mapError(500))
    }
}
