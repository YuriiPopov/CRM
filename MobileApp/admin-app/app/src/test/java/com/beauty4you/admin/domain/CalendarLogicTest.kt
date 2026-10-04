package com.beauty4you.admin.domain

import com.beauty4you.admin.domain.BookingStatus.CANCELLED
import com.beauty4you.admin.domain.BookingStatus.CREATED
import com.beauty4you.admin.domain.BookingStatus.NO_SHOW
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class CalendarLogicTest {

    private val maria = Master("m1", "Maria")
    private val olga = Master("m2", "Olga")
    private val inactive = Master("m3", "Anna", isActive = false)

    private val bookings = listOf(
        booking("late", at(15), masterId = "m1"),
        booking("early", at(9), masterId = "m2", status = CREATED),
        booking("cancelled", at(11), masterId = "m1", status = CANCELLED),
        booking("tomorrow", at(10, date = DAY.plusDays(1)), masterId = "m1"),
    )

    @Test
    fun `week starts on monday and has seven days`() {
        assertEquals(LocalDate.of(2026, 10, 5), CalendarLogic.weekStartOf(DAY))
        assertEquals(LocalDate.of(2026, 10, 5), CalendarLogic.weekStartOf(LocalDate.of(2026, 10, 5)))
        assertEquals(LocalDate.of(2026, 10, 5), CalendarLogic.weekStartOf(LocalDate.of(2026, 10, 11)))
        val week = CalendarLogic.weekDates(LocalDate.of(2026, 10, 5))
        assertEquals(7, week.size)
        assertEquals(LocalDate.of(2026, 10, 11), week.last())
    }

    @Test
    fun `filter keeps the selected day sorted by time`() {
        val result = CalendarLogic.filterBookings(bookings, CalendarFilter(), DAY)
        assertEquals(listOf("early", "cancelled", "late"), result.map { it.id })
    }

    @Test
    fun `filter by master and by status combine`() {
        assertEquals(
            listOf("cancelled", "late"),
            CalendarLogic.filterBookings(bookings, CalendarFilter(masterId = "m1"), DAY).map { it.id },
        )
        assertEquals(
            listOf("early"),
            CalendarLogic.filterBookings(bookings, CalendarFilter(status = CREATED), DAY).map { it.id },
        )
        assertEquals(
            emptyList<String>(),
            CalendarLogic.filterBookings(bookings, CalendarFilter(masterId = "m1", status = CREATED), DAY).map { it.id },
        )
    }

    @Test
    fun `timeline hides cancelled unless explicitly filtered`() {
        assertEquals(listOf("early", "late"), CalendarLogic.timelineBookings(bookings, CalendarFilter(), DAY).map { it.id })
        assertEquals(
            listOf("cancelled"),
            CalendarLogic.timelineBookings(bookings, CalendarFilter(status = CANCELLED), DAY).map { it.id },
        )
    }

    @Test
    fun `timeline hides no-shows like cancellations unless filtered by Nieobecna`() {
        val withNoShow = bookings + booking("no-show", at(13), masterId = "m1", status = NO_SHOW)
        assertEquals(listOf("early", "late"), CalendarLogic.timelineBookings(withNoShow, CalendarFilter(), DAY).map { it.id })
        assertEquals(
            listOf("no-show"),
            CalendarLogic.timelineBookings(withNoShow, CalendarFilter(status = NO_SHOW), DAY).map { it.id },
        )
        // Список (Lista) показывает неявку под своим статусом
        assertEquals(
            listOf("early", "cancelled", "no-show", "late"),
            CalendarLogic.filterBookings(withNoShow, CalendarFilter(), DAY).map { it.id },
        )
    }

    @Test
    fun `group by master follows master order and skips empty masters`() {
        val day = CalendarLogic.filterBookings(bookings, CalendarFilter(), DAY)
        val groups = CalendarLogic.groupByMaster(day, listOf(olga, maria, inactive))
        assertEquals(listOf("m2", "m1"), groups.map { it.master.id })
        assertEquals(listOf("cancelled", "late"), groups[1].bookings.map { it.id })
    }

    @Test
    fun `booking of an unknown master is kept in a placeholder group`() {
        val orphan = booking("orphan", at(12), masterId = "gone")
        val groups = CalendarLogic.groupByMaster(listOf(orphan), listOf(maria))
        assertEquals(1, groups.size)
        assertEquals("gone", groups[0].master.id)
        assertEquals("—", groups[0].master.name)
    }

    @Test
    fun `timeline columns are active masters sorted by name plus inactive ones with bookings`() {
        assertEquals(listOf("Maria", "Olga"), CalendarLogic.timelineMasters(listOf(olga, maria, inactive), CalendarFilter(), emptyList()).map { it.name })

        val withInactive = listOf(booking("x", at(10), masterId = "m3"))
        assertEquals(
            listOf("Anna", "Maria", "Olga"),
            CalendarLogic.timelineMasters(listOf(olga, maria, inactive), CalendarFilter(), withInactive).map { it.name },
        )
    }

    @Test
    fun `timeline shows only the filtered master`() {
        assertEquals(listOf("m2"), CalendarLogic.timelineMasters(listOf(olga, maria), CalendarFilter(masterId = "m2"), emptyList()).map { it.id })
    }
}
