package com.beauty4you.admin.domain

import com.beauty4you.admin.domain.BookingStatus.CANCELLED
import com.beauty4you.admin.domain.BookingStatus.COMPLETED
import com.beauty4you.admin.domain.BookingStatus.CONFIRMED
import com.beauty4you.admin.domain.BookingStatus.CREATED
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BookingStatusRulesTest {

    @Test
    fun `transitions mirror the backend state machine`() {
        assertEquals(listOf(CONFIRMED, CANCELLED), BookingStatusRules.allowedTransitions(CREATED))
        assertEquals(listOf(COMPLETED, CANCELLED), BookingStatusRules.allowedTransitions(CONFIRMED))
        assertEquals(emptyList<BookingStatus>(), BookingStatusRules.allowedTransitions(COMPLETED))
        assertEquals(emptyList<BookingStatus>(), BookingStatusRules.allowedTransitions(CANCELLED))
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

        assertTrue(BookingStatusRules.canCancel(CREATED))
        assertTrue(BookingStatusRules.canCancel(CONFIRMED))
        assertFalse(BookingStatusRules.canCancel(COMPLETED))
        assertFalse(BookingStatusRules.canCancel(CANCELLED))
    }

    @Test
    fun `new booking can be saved as pending or confirmed`() {
        assertEquals(listOf(CREATED, CONFIRMED), BookingStatusRules.formStatusOptions(null))
    }

    @Test
    fun `form offers current status plus allowed moves except cancel which has its own button`() {
        assertEquals(listOf(CREATED, CONFIRMED), BookingStatusRules.formStatusOptions(CREATED))
        assertEquals(listOf(CONFIRMED, COMPLETED), BookingStatusRules.formStatusOptions(CONFIRMED))
        assertEquals(listOf(COMPLETED), BookingStatusRules.formStatusOptions(COMPLETED))
        assertEquals(listOf(CANCELLED), BookingStatusRules.formStatusOptions(CANCELLED))
    }
}
