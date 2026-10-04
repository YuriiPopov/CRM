package com.beauty4you.admin.domain

import com.beauty4you.admin.domain.BookingStatus.CANCELLED
import com.beauty4you.admin.domain.BookingStatus.COMPLETED
import com.beauty4you.admin.domain.BookingStatus.CONFIRMED
import com.beauty4you.admin.domain.BookingStatus.CREATED
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

class DashboardLogicTest {

    private val weekStart = LocalDate.of(2026, 10, 5)

    @Test
    fun `today excludes cancelled and is sorted`() {
        val bookings = listOf(
            booking("b", at(14)),
            booking("a", at(9), status = COMPLETED),
            booking("x", at(10), status = CANCELLED),
            booking("other-day", at(9, date = DAY.plusDays(1))),
        )
        assertEquals(listOf("a", "b"), DashboardLogic.todayBookings(bookings, DAY).map { it.id })
    }

    @Test
    fun `upcoming are the next three open bookings from now`() {
        val bookings = listOf(
            booking("past", at(8)),
            booking("done", at(13), status = COMPLETED),
            booking("cancel", at(13, 30), status = CANCELLED),
            booking("u3", at(9, date = DAY.plusDays(2))),
            booking("u1", at(12), status = CREATED),
            booking("u2", at(16), status = CONFIRMED),
            booking("u4", at(9, date = DAY.plusDays(3))),
        )
        assertEquals(listOf("u1", "u2", "u3"), DashboardLogic.upcomingBookings(bookings, at(12)).map { it.id })
    }

    @Test
    fun `week markers list one master color per active booking`() {
        val bookings = listOf(
            booking("1", at(10, date = weekStart), masterId = "m2"),
            booking("2", at(9, date = weekStart), masterId = "m1"),
            booking("3", at(11, date = weekStart), masterId = "m1", status = CANCELLED),
            booking("4", at(9, date = weekStart.plusDays(6)), masterId = "m3"),
        )
        val week = DashboardLogic.weekMarkers(bookings, weekStart)
        assertEquals(7, week.size)
        assertEquals(listOf("m1", "m2"), week[0].masterIds)
        assertEquals(emptyList<String>(), week[1].masterIds)
        assertEquals(listOf("m3"), week[6].masterIds)
    }

    @Test
    fun `week markers are capped with an overflow count`() {
        val bookings = (0 until 8).map { booking("b$it", at(9 + it, date = weekStart)) }
        val day = DashboardLogic.weekMarkers(bookings, weekStart, maxPerDay = 5)[0]
        assertEquals(5, day.masterIds.size)
        assertEquals(3, day.overflow)
    }

    @Test
    fun `earliest pending date points to the nearest future pending booking`() {
        val bookings = listOf(
            booking("past", at(8), status = CREATED),
            booking("later", at(10, date = DAY.plusDays(5)), status = CREATED),
            booking("sooner", at(10, date = DAY.plusDays(2)), status = CREATED),
            booking("confirmed", at(10, date = DAY.plusDays(1)), status = CONFIRMED),
        )
        assertEquals(DAY.plusDays(2), DashboardLogic.earliestPendingDate(bookings, at(12)))
        assertNull(DashboardLogic.earliestPendingDate(emptyList(), at(12)))
    }

    @Test
    fun `today count by master`() {
        val bookings = listOf(
            booking("1", at(9), masterId = "m1"),
            booking("2", at(11), masterId = "m1"),
            booking("3", at(12), masterId = "m2", status = CANCELLED),
        )
        assertEquals(mapOf("m1" to 2), DashboardLogic.todayCountByMaster(bookings, DAY))
    }
}
