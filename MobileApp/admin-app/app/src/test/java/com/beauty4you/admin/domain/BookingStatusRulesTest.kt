package com.beauty4you.admin.domain

import com.beauty4you.admin.domain.BookingStatus.CANCELLED
import com.beauty4you.admin.domain.BookingStatus.COMPLETED
import com.beauty4you.admin.domain.BookingStatus.CONFIRMED
import com.beauty4you.admin.domain.BookingStatus.CREATED
import com.beauty4you.admin.domain.BookingStatus.NO_SHOW
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BookingStatusRulesTest {

    @Test
    fun `transitions mirror the backend state machine`() {
        assertEquals(listOf(CONFIRMED, CANCELLED), BookingStatusRules.allowedTransitions(CREATED))
        assertEquals(listOf(COMPLETED, CANCELLED, NO_SHOW), BookingStatusRules.allowedTransitions(CONFIRMED))
        assertEquals(emptyList<BookingStatus>(), BookingStatusRules.allowedTransitions(COMPLETED))
        assertEquals(emptyList<BookingStatus>(), BookingStatusRules.allowedTransitions(CANCELLED))
        assertEquals(emptyList<BookingStatus>(), BookingStatusRules.allowedTransitions(NO_SHOW))
    }

    @Test
    fun `cannot skip confirmation or reopen a closed booking`() {
        assertFalse(BookingStatusRules.canTransition(CREATED, COMPLETED))
        assertFalse(BookingStatusRules.canTransition(CANCELLED, CONFIRMED))
        assertFalse(BookingStatusRules.canTransition(COMPLETED, CANCELLED))
        assertTrue(BookingStatusRules.canTransition(CONFIRMED, COMPLETED))
    }

    @Test
    fun `only open bookings can be rescheduled or cancelled`() {
        assertTrue(BookingStatusRules.canReschedule(CREATED))
        assertTrue(BookingStatusRules.canReschedule(CONFIRMED))
        assertFalse(BookingStatusRules.canReschedule(COMPLETED))
        assertFalse(BookingStatusRules.canReschedule(CANCELLED))
        assertFalse(BookingStatusRules.canReschedule(NO_SHOW))

        assertTrue(BookingStatusRules.canCancel(CREATED))
        assertTrue(BookingStatusRules.canCancel(CONFIRMED))
        assertFalse(BookingStatusRules.canCancel(COMPLETED))
        assertFalse(BookingStatusRules.canCancel(CANCELLED))
        assertFalse(BookingStatusRules.canCancel(NO_SHOW))
    }

    @Test
    fun `new booking can be saved as pending or confirmed`() {
        assertEquals(listOf(CREATED, CONFIRMED), BookingStatusRules.formStatusOptions(null, at(12)))
    }

    @Test
    fun `form offers current status plus allowed moves except cancel which has its own button`() {
        // Запись в 15:00, «сейчас» 12:00 — визит ещё не начался, «Nieobecna» не предлагается
        val now = at(12)
        fun options(status: BookingStatus) = BookingStatusRules.formStatusOptions(booking("b", at(15), status = status), now)
        assertEquals(listOf(CREATED, CONFIRMED), options(CREATED))
        assertEquals(listOf(CONFIRMED, COMPLETED), options(CONFIRMED))
        assertEquals(listOf(COMPLETED), options(COMPLETED))
        assertEquals(listOf(CANCELLED), options(CANCELLED))
        assertEquals(listOf(NO_SHOW), options(NO_SHOW))
    }

    @Test
    fun `no-show is offered only for a confirmed booking whose start time has come`() {
        val now = at(12)
        assertEquals(
            listOf(CONFIRMED, COMPLETED, NO_SHOW),
            BookingStatusRules.formStatusOptions(booking("past", at(10), status = CONFIRMED), now),
        )
        assertTrue(BookingStatusRules.canMarkNoShow(CONFIRMED, at(12), now)) // ровно в момент начала
        assertFalse(BookingStatusRules.canMarkNoShow(CONFIRMED, at(12, 1), now))
        assertFalse(BookingStatusRules.canMarkNoShow(CREATED, at(10), now))
        assertFalse(BookingStatusRules.canMarkNoShow(COMPLETED, at(10), now))
        assertFalse(BookingStatusRules.canMarkNoShow(NO_SHOW, at(10), now))
        assertEquals(
            listOf(CREATED, CONFIRMED),
            BookingStatusRules.formStatusOptions(booking("past-pending", at(10), status = CREATED), now),
        )
    }
}
