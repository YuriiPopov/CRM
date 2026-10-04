package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class PolishDatesTest {

    @Test
    fun `long date uses capitalised weekday and genitive month`() {
        assertEquals("Wtorek, 8 września 2026", PolishDates.longDate(LocalDate.of(2026, 9, 8)))
        assertEquals("Niedziela, 4 października 2026", PolishDates.longDate(LocalDate.of(2026, 10, 4)))
        assertEquals("Poniedziałek, 1 lutego 2027", PolishDates.longDate(LocalDate.of(2027, 2, 1)))
    }

    @Test
    fun `short weekday labels follow the design`() {
        val monday = LocalDate.of(2026, 10, 5)
        assertEquals(
            listOf("Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"),
            (0L..6L).map { PolishDates.weekdayShort(monday.plusDays(it)) },
        )
    }

    @Test
    fun `relative day labels`() {
        val today = LocalDate.of(2026, 10, 4)
        assertEquals("Dzisiaj", PolishDates.relativeDay(today, today))
        assertEquals("Jutro", PolishDates.relativeDay(today.plusDays(1), today))
        assertEquals("Wczoraj", PolishDates.relativeDay(today.minusDays(1), today))
        assertEquals("12 paź", PolishDates.relativeDay(LocalDate.of(2026, 10, 12), today))
        assertEquals("3 sty 2027", PolishDates.relativeDay(LocalDate.of(2027, 1, 3), today))
    }

    @Test
    fun `time is zero padded 24h`() {
        assertEquals("09:05", PolishDates.time(LocalTime.of(9, 5)))
        assertEquals("17:30", PolishDates.time(LocalTime.of(17, 30)))
    }

    @Test
    fun `week range within a month, across months and across years`() {
        assertEquals("5–11 października 2026", PolishDates.weekRange(LocalDate.of(2026, 10, 5)))
        assertEquals("28 września – 4 października 2026", PolishDates.weekRange(LocalDate.of(2026, 9, 28)))
        assertEquals("28 grudnia 2026 – 3 stycznia 2027", PolishDates.weekRange(LocalDate.of(2026, 12, 28)))
    }
}
