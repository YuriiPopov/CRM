package com.beauty4you.client.data

import com.beauty4you.client.data.remote.BookingDto
import com.beauty4you.client.data.remote.CatalogDto
import com.beauty4you.client.data.remote.CategoryDto
import com.beauty4you.client.data.remote.MasterDto
import com.beauty4you.client.data.remote.SalonDto
import com.beauty4you.client.data.remote.ServiceDto
import com.beauty4you.client.data.remote.SlotDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.LocalTime

class MappersTest {

    private fun booking(status: String, start: String = "2026-09-30T09:00:00.000Z") = BookingDto(
        id = "b1", serviceId = "s1", serviceName = "Manicure", masterId = "m1", masterName = "Olga",
        startTime = start, endTime = start, status = status, price = 110.0,
    ).toDomain()

    @Test
    fun `salon time is read as-is from UTC, not shifted to device timezone`() {
        assertEquals(LocalDateTime.of(2026, 9, 30, 9, 0), parseSalonTime("2026-09-30T09:00:00.000Z"))
        assertEquals(LocalTime.of(13, 15), SlotDto("2026-09-30T13:15:00.000Z", "2026-09-30T14:00:00.000Z").toDomain().time)
    }

    @Test
    fun `backend statuses map to UI statuses`() {
        assertEquals(BookingStatus.PENDING, booking("CREATED").status)
        assertEquals(BookingStatus.CONFIRMED, booking("CONFIRMED").status)
        assertEquals(BookingStatus.DONE, booking("COMPLETED").status)
        assertEquals(BookingStatus.CANCELLED, booking("CANCELLED").status)
        assertEquals(BookingStatus.NO_SHOW, booking("NO_SHOW").status)
    }

    @Test
    fun `only active future bookings are upcoming`() {
        val now = LocalDateTime.of(2026, 9, 30, 8, 0)
        assertTrue(booking("CREATED").isUpcoming(now))
        assertTrue(booking("CONFIRMED").isUpcoming(now))
        assertFalse(booking("CANCELLED").isUpcoming(now))
        assertFalse(booking("NO_SHOW").isUpcoming(now))
        assertFalse(booking("CONFIRMED").isUpcoming(now.plusHours(2))) // уже началась
    }

    @Test
    fun `catalog maps categories, emoji and master specialty`() {
        val dto = CatalogDto(
            salon = SalonDto("B4U Demo Salon"),
            categories = listOf(CategoryDto("c1", "Маникюр/педикюр"), CategoryDto("c2", "Massage")),
            services = listOf(
                ServiceDto("s1", "Классический маникюр", "c1", 120, 100.0),
                ServiceDto("s2", "Relax", "c2", 30, 99.5),
            ),
            masters = listOf(MasterDto("m1", "Наталья", null, listOf("s1"), listOf("Маникюр/педикюр", "СПА"))),
        )

        val catalog = dto.toDomain(decodePhoto = { null })

        assertEquals("B4U Demo Salon", catalog.salonName)
        assertEquals("💅", catalog.service("s1")!!.emoji)
        assertEquals("💆", catalog.service("s2")!!.emoji)
        assertEquals("Маникюр/педикюр, СПА", catalog.master("m1")!!.specialty)
        assertNull(catalog.master("m1")!!.photo)
        assertEquals(listOf("m1"), catalog.mastersFor("s1").map { it.id })
        assertTrue(catalog.mastersFor("s2").isEmpty())
    }

    @Test
    fun `unknown category falls back to sparkles`() {
        assertEquals("✨", serviceEmoji("Inne", "Konsultacja"))
    }

    @Test
    fun `master color is stable per id`() {
        assertEquals(masterColor("b76dfaf6-9d4c-45c8-9db7-15b74db3bb73"), masterColor("b76dfaf6-9d4c-45c8-9db7-15b74db3bb73"))
    }

    @Test
    fun `client initials and first name`() {
        val client = Client("c1", "Jerzy Popov", "+48798259790", null)
        assertEquals("Jerzy", client.firstName)
        assertEquals("JP", client.initials)
        assertEquals("A", Client("c2", "asia", "+48", null).initials)
    }
}
