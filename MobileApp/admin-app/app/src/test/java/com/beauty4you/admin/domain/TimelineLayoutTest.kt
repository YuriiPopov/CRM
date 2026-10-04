package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalTime

class TimelineLayoutTest {

    @Test
    fun `grid has 40 quarter rows from 09_00 with solid hours`() {
        val lines = TimelineLayout.gridLines()
        assertEquals(40, lines.size)
        assertEquals(TimelineGridLine("09:00", 0, true), lines.first())
        assertEquals(TimelineGridLine("15", 15, false), lines[1])
        assertEquals(TimelineGridLine("10:00", 60, true), lines[4])
        assertEquals(TimelineGridLine("45", 585, false), lines.last())
        assertEquals(10, lines.count { it.isHour })
    }

    @Test
    fun `booking is placed by its real duration`() {
        assertEquals(TimelineSpan(90, 45), TimelineLayout.layout(at(10, 30), at(11, 15), DAY))
        assertEquals(TimelineSpan(0, 120), TimelineLayout.layout(at(9), at(11), DAY))
    }

    @Test
    fun `edges are clamped to the 09_00-19_00 window`() {
        assertEquals(TimelineSpan(0, 30), TimelineLayout.layout(at(8), at(9, 30), DAY))
        assertEquals(TimelineSpan(570, 30), TimelineLayout.layout(at(18, 30), at(20), DAY))
    }

    @Test
    fun `intervals fully outside the window are not drawn`() {
        assertNull(TimelineLayout.layout(at(7), at(9), DAY))
        assertNull(TimelineLayout.layout(at(19), at(20), DAY))
        assertNull(TimelineLayout.layout(at(10, date = DAY.plusDays(1)), at(11, date = DAY.plusDays(1)), DAY))
    }

    @Test
    fun `short booking gets minimum height without overflowing the bottom`() {
        assertEquals(TimelineSpan(60, 15), TimelineLayout.layout(at(10), at(10, 5), DAY))
        assertEquals(TimelineSpan(585, 15), TimelineLayout.layout(at(18, 55), at(19), DAY))
    }

    @Test
    fun `multi-day block covers the whole day`() {
        val vacation = MasterBlock("b", "m1", at(0, date = DAY.minusDays(2)), at(23, date = DAY.plusDays(3)))
        assertEquals(TimelineSpan(0, 600), TimelineLayout.layoutBlock(vacation, DAY))
    }

    @Test
    fun `schedule unavailability`() {
        assertEquals(emptyList<TimelineSpan>(), TimelineLayout.scheduleUnavailable(null))
        assertEquals(
            listOf(TimelineSpan(0, 600)),
            TimelineLayout.scheduleUnavailable(ScheduleDay("m1", DAY, isWorking = false)),
        )
        assertEquals(
            listOf(TimelineSpan(0, 60), TimelineSpan(480, 120)),
            TimelineLayout.scheduleUnavailable(ScheduleDay("m1", DAY, true, LocalTime.of(10, 0), LocalTime.of(17, 0))),
        )
        // Смена шире окна — заливки нет
        assertEquals(
            emptyList<TimelineSpan>(),
            TimelineLayout.scheduleUnavailable(ScheduleDay("m1", DAY, true, LocalTime.of(8, 0), LocalTime.of(20, 0))),
        )
    }

    @Test
    fun `hours label`() {
        assertEquals("—", TimelineLayout.hoursLabel(null))
        assertEquals("Wolne", TimelineLayout.hoursLabel(ScheduleDay("m1", DAY, isWorking = false)))
        assertEquals("10:00–17:30", TimelineLayout.hoursLabel(ScheduleDay("m1", DAY, true, LocalTime.of(10, 0), LocalTime.of(17, 30))))
    }
}
