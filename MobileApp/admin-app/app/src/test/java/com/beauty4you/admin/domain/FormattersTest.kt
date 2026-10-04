package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FormattersTest {

    @Test
    fun `price drops zero decimals and uses a comma otherwise`() {
        assertEquals("150 zł", Formatters.price("150.00"))
        assertEquals("100 zł", Formatters.price("100"))
        assertEquals("99,50 zł", Formatters.price("99.5"))
        assertEquals("abc zł", Formatters.price("abc"))
    }

    @Test
    fun `greeting name comes from the email local part`() {
        assertEquals("Admin", Formatters.greetingName("admin@b4u.local"))
        assertEquals("Anna", Formatters.greetingName("anna.nowak@salon.pl"))
        assertEquals("Admin", Formatters.greetingName(null))
    }

    @Test
    fun `master color is the web CRM palette hash`() {
        // Значения совпадают с frontend/src/pages/dashboard/masterColor.ts (тот же хэш и палитра)
        val palette = setOf(0xFF2563EB, 0xFF16A34A, 0xFFD97706, 0xFFDB2777, 0xFF7C3AED, 0xFF0891B2, 0xFFDC2626, 0xFF65A30D)
        val color = MasterColors.argb("352ef09e-7fe7-475c-abcb-d94df03d5661")
        assertTrue(color in palette)
        assertEquals(color, MasterColors.argb("352ef09e-7fe7-475c-abcb-d94df03d5661"))
        // "a" -> hash 97 -> 97 % 8 = 1 -> green
        assertEquals(0xFF16A34A, MasterColors.argb("a"))
    }
}
