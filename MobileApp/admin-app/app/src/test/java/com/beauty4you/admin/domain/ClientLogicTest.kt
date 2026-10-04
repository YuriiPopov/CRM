package com.beauty4you.admin.domain

import com.beauty4you.admin.domain.BookingStatus.CANCELLED
import com.beauty4you.admin.domain.BookingStatus.COMPLETED
import com.beauty4you.admin.domain.BookingStatus.CONFIRMED
import com.beauty4you.admin.domain.BookingStatus.CREATED
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ClientLogicTest {

    private val clients = listOf(
        Client("c1", "Anna Kowalska", "+48 601 234 567"),
        Client("c2", "Paweł Łukasiewicz", "+48 602 345 678"),
        Client("c3", "Олена Шевчук", "+380 67 123 4567"),
    )

    @Test
    fun `initials take the first letters of two words`() {
        assertEquals("AK", ClientLogic.initials("Anna Kowalska"))
        assertEquals("AM", ClientLogic.initials("  anna   maria  kowalska "))
        assertEquals("M", ClientLogic.initials("Madonna"))
        assertEquals("", ClientLogic.initials("  "))
    }

    @Test
    fun `search by name ignores case and polish diacritics`() {
        assertEquals(listOf("c2"), ClientLogic.search(clients, "lukas").map { it.id })
        assertEquals(listOf("c2"), ClientLogic.search(clients, "PAWEŁ").map { it.id })
        assertEquals(listOf("c1"), ClientLogic.search(clients, "kowal").map { it.id })
        assertEquals(listOf("c3"), ClientLogic.search(clients, "олена").map { it.id })
    }

    @Test
    fun `search by phone matches digits regardless of formatting`() {
        assertEquals(listOf("c1"), ClientLogic.search(clients, "601234").map { it.id })
        assertEquals(listOf("c2"), ClientLogic.search(clients, "602 345").map { it.id })
    }

    @Test
    fun `blank query returns everyone`() {
        assertEquals(3, ClientLogic.search(clients, "  ").size)
    }

    @Test
    fun `polish numbers are normalised to +48 xxx xxx xxx`() {
        assertEquals("+48 601 234 567", ClientLogic.normalizePhone("601234567"))
        assertEquals("+48 601 234 567", ClientLogic.normalizePhone("601 234 567"))
        assertEquals("+48 601 234 567", ClientLogic.normalizePhone("+48601234567"))
        assertEquals("+48 601 234 567", ClientLogic.normalizePhone("+48 601-234-567"))
        assertEquals("+48 601 234 567", ClientLogic.normalizePhone("0048 601 234 567"))
    }

    @Test
    fun `other international numbers are accepted compactly`() {
        assertEquals("+380671234567", ClientLogic.normalizePhone("+380 67 123 4567"))
    }

    @Test
    fun `invalid phones are rejected`() {
        assertNull(ClientLogic.normalizePhone(""))
        assertNull(ClientLogic.normalizePhone("12345"))
        assertNull(ClientLogic.normalizePhone("60123456"))
        assertNull(ClientLogic.normalizePhone("6012345678"))
        assertNull(ClientLogic.normalizePhone("601abc567"))
        assertNull(ClientLogic.normalizePhone("+48 601 234 56"))
        assertNull(ClientLogic.normalizePhone("+4860+1234567"))
    }

    @Test
    fun `new client validation`() {
        assertEquals(NewClientValidation.NameMissing, ClientLogic.validateNewClient("  ", "601234567"))
        assertEquals(NewClientValidation.PhoneInvalid, ClientLogic.validateNewClient("Anna", "123"))
        assertEquals(
            NewClientValidation.Valid("Anna Nowak", "+48 601 234 567"),
            ClientLogic.validateNewClient("  Anna Nowak ", "601234567"),
        )
    }

    @Test
    fun `completed visits per client`() {
        val bookings = listOf(
            booking("1", at(9), clientId = "c1", status = COMPLETED),
            booking("2", at(10), clientId = "c1", status = COMPLETED),
            booking("3", at(11), clientId = "c1", status = CANCELLED),
            booking("4", at(12), clientId = "c2", status = CONFIRMED),
            booking("5", at(13), clientId = "c1", status = BookingStatus.NO_SHOW),
        )
        // Неявка (item74) не считается визитом
        assertEquals(mapOf("c1" to 2), ClientLogic.completedVisitsByClient(bookings))
    }

    @Test
    fun `client stats and history`() {
        val bookings = listOf(
            booking("done", at(9, date = DAY.minusDays(10)), status = COMPLETED),
            booking("next", at(15), status = CONFIRMED),
            booking("pending", at(10, date = DAY.plusDays(3)), status = CREATED),
            booking("missed-open", at(8), status = CONFIRMED),
            booking("cancelled", at(16), status = CANCELLED),
        )
        assertEquals(ClientStats(completedVisits = 1, upcoming = 2), ClientLogic.stats(bookings, at(12)))
        assertEquals(
            listOf("pending", "cancelled", "next", "missed-open", "done"),
            ClientLogic.history(bookings).map { it.id },
        )
    }

    @Test
    fun `formatPhone groups 9-digit Polish numbers`() {
        assertEquals("+48 601 234 567", ClientLogic.formatPhone("601234567"))
        assertEquals("+48 601 234 567", ClientLogic.formatPhone("+48601234567"))
        assertEquals("+48 601 234 567", ClientLogic.formatPhone("+48 601-234-567"))
        assertEquals("+48 601 234 567", ClientLogic.formatPhone("0048601234567"))
        assertEquals("+48 601 234 567", ClientLogic.formatPhone("+48 601 234 567"))
    }

    @Test
    fun `formatPhone keeps other numbers as is`() {
        assertEquals("+380501234567", ClientLogic.formatPhone("+380501234567"))
        assertEquals("60123456", ClientLogic.formatPhone("60123456"))
        assertEquals("+48 60123456", ClientLogic.formatPhone("+48 60123456"))
        assertEquals("6012345678", ClientLogic.formatPhone("6012345678"))
        assertEquals("", ClientLogic.formatPhone(""))
    }
}
