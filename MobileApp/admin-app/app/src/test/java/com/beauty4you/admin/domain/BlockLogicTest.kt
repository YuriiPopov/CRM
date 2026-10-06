package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class BlockLogicTest {

    private val today = LocalDate.of(2026, 10, 6)
    private fun t(h: Int, m: Int = 0) = LocalTime.of(h, m)

    @Test
    fun `new block form defaults to the whole working day today`() {
        assertEquals(BlockForm(today, t(9), t(19), BlockReason.URLOP, ""), BlockLogic.newForm(today))
        assertTrue(BlockLogic.validate(BlockLogic.newForm(today), today).isEmpty())
    }

    @Test
    fun `reason is stored as readable polish text`() {
        val form = BlockLogic.newForm(today)
        assertEquals("Urlop", BlockLogic.reasonText(form))
        assertEquals("Przerwa: lekarz", BlockLogic.reasonText(form.copy(reason = BlockReason.PRZERWA, comment = "  lekarz ")))
        assertEquals("Inne: szkolenie", BlockLogic.reasonText(form.copy(reason = BlockReason.INNE, comment = "szkolenie")))
    }

    @Test
    fun `validation checks date, hours and the comment for Inne`() {
        val form = BlockLogic.newForm(today)
        assertEquals(setOf(BlockFieldError.DATE_IN_PAST), BlockLogic.validate(form.copy(date = today.minusDays(1)), today))
        assertEquals(setOf(BlockFieldError.START_NOT_BEFORE_END), BlockLogic.validate(form.copy(start = t(12), end = t(11)), today))
        assertEquals(setOf(BlockFieldError.OUT_OF_RANGE), BlockLogic.validate(form.copy(start = t(5)), today))
        assertEquals(setOf(BlockFieldError.COMMENT_REQUIRED), BlockLogic.validate(form.copy(reason = BlockReason.INNE, comment = "  "), today))
        assertEquals(
            setOf(BlockFieldError.COMMENT_TOO_LONG),
            BlockLogic.validate(form.copy(comment = "x".repeat(BlockLogic.REASON_MAX)), today),
        )
    }

    @Test
    fun `empty form is not dirty, whitespace in comment does not count`() {
        val initial = BlockLogic.newForm(today)
        assertFalse(BlockLogic.isDirty(initial, initial))
        assertFalse(BlockLogic.isDirty(initial, initial.copy(comment = "   ")))
        assertTrue(BlockLogic.isDirty(initial, initial.copy(start = t(10))))
        assertTrue(BlockLogic.isDirty(initial, initial.copy(reason = BlockReason.PRZERWA)))
        assertTrue(BlockLogic.isDirty(initial, initial.copy(date = today.plusDays(1))))
    }

    @Test
    fun `api time is salon time with a UTC label`() {
        assertEquals("2026-10-07T09:30:00.000Z", BlockLogic.toApiDateTime(LocalDate.of(2026, 10, 7), t(9, 30)))
    }

    @Test
    fun `upcoming keeps this master's blocks that have not ended, by start`() {
        fun block(id: String, master: String, start: LocalDateTime, end: LocalDateTime) = MasterBlock(id, master, start, end)
        val blocks = listOf(
            block("later", "m1", LocalDateTime.of(2026, 10, 9, 10, 0), LocalDateTime.of(2026, 10, 9, 12, 0)),
            block("past", "m1", LocalDateTime.of(2026, 10, 1, 10, 0), LocalDateTime.of(2026, 10, 1, 12, 0)),
            block("other", "m2", LocalDateTime.of(2026, 10, 8, 10, 0), LocalDateTime.of(2026, 10, 8, 12, 0)),
            // Многодневный отпуск, начавшийся вчера, ещё идёт
            block("vacation", "m1", LocalDateTime.of(2026, 10, 5, 9, 0), LocalDateTime.of(2026, 10, 7, 19, 0)),
        )
        assertEquals(listOf("vacation", "later"), BlockLogic.upcoming(blocks, "m1", today).map { it.id })
    }

    @Test
    fun `backend errors map to form messages`() {
        assertEquals(BlockError.NETWORK, BlockLogic.mapError(null, null))
        assertEquals(
            BlockError.OVERLAPS_BOOKING,
            BlockLogic.mapError(409, "Cannot block this time: master has active bookings during this period"),
        )
        assertEquals(BlockError.OVERLAPS_BLOCK, BlockLogic.mapError(409, "This time is already blocked for the master"))
        assertEquals(BlockError.VALIDATION, BlockLogic.mapError(400, "endTime must be after startTime"))
        assertEquals(BlockError.NOT_FOUND, BlockLogic.mapError(404, "Block not found"))
        assertEquals(BlockError.UNKNOWN, BlockLogic.mapError(500, null))
    }
}
