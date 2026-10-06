package com.beauty4you.client.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PhoneInputTest {

    @Test fun `pasted variants all give nine digits`() {
        listOf(
            "+48601234567", "0048601234567", "48601234567",
            "601 234 567", "601-234-567", "601234567",
            "+48 601 234 567", "+48 (601) 234-567",
        ).forEach { assertEquals(it, "601234567", PhoneInput.normalize(it)) }
    }

    @Test fun `empty and garbage give empty`() {
        assertEquals("", PhoneInput.normalize(""))
        assertEquals("", PhoneInput.normalize("abc +-() "))
    }

    @Test fun `garbage between digits is dropped`() {
        assertEquals("601234567", PhoneInput.normalize("tel. 601x234y567!"))
    }

    @Test fun `more than nine digits is truncated`() {
        assertEquals("601234567", PhoneInput.normalize("6012345678901"))
    }

    @Test fun `typing digit by digit is not mistaken for country code`() {
        assertEquals("4", PhoneInput.normalize("4"))
        assertEquals("48", PhoneInput.normalize("48"))
        assertEquals("486", PhoneInput.normalize("486"))
        assertEquals("48601234", PhoneInput.normalize("48601234"))
    }

    @Test fun `national number starting with 48 typed in full stays intact`() {
        assertEquals("486012345", PhoneInput.normalize("486012345"))
    }

    @Test fun `format groups by three`() {
        assertEquals("", PhoneInput.format(""))
        assertEquals("60", PhoneInput.format("60"))
        assertEquals("601 23", PhoneInput.format("60123"))
        assertEquals("601 234 567", PhoneInput.format("601234567"))
    }

    @Test fun `complete only with nine digits`() {
        assertFalse(PhoneInput.isComplete("60123456"))
        assertTrue(PhoneInput.isComplete("601234567"))
    }

    @Test fun `e164 for server`() {
        assertEquals("+48601234567", PhoneInput.toE164("601234567"))
    }
}
