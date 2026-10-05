package com.beauty4you.client.data

import com.beauty4you.client.data.remote.BookingDto
import com.beauty4you.client.data.remote.CatalogDto
import com.beauty4you.client.data.remote.CategoryDto
import com.beauty4you.client.data.remote.MasterDto
import com.beauty4you.client.data.remote.NewsDto
import com.beauty4you.client.data.remote.SalonDto
import com.beauty4you.client.data.remote.ServiceDto
import com.beauty4you.client.data.remote.SlotDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

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

    // --- Aktualności (item75) ---

    private val warsaw = ZoneId.of("Europe/Warsaw")

    private fun news(
        id: String,
        publishedAt: String,
        category: String = "NOWOSC",
        imageUrl: String? = null,
    ) = NewsDto(id = id, category = category, title = "Tytuł $id", body = "Treść $id", imageUrl = imageUrl, publishedAt = publishedAt)

    @Test
    fun `news feed maps title, text, category tag and publication date`() {
        val item = listOf(news("n1", "2026-10-03T08:15:00.000Z", category = "INSPIRACJA")).toNewsFeed({ null }, warsaw).single()

        assertEquals("n1", item.id)
        assertEquals("Tytuł n1", item.title)
        assertEquals("Treść n1", item.text)
        assertEquals("Inspiracja", item.tag.label)
        assertEquals(LocalDate.of(2026, 10, 3), item.date)
        assertNull(item.image)
    }

    @Test
    fun `every backend category has its own tag`() {
        val labels = listOf("NOWOSC", "DIGEST", "INSPIRACJA")
            .mapIndexed { i, c -> news("n$i", "2026-10-0${i + 1}T08:00:00.000Z", category = c) }
            .toNewsFeed({ null }, warsaw)
            .map { it.tag.label }
            .sorted()
        assertEquals(listOf("Digest", "Inspiracja", "Nowość"), labels)
    }

    @Test
    fun `news feed is newest first`() {
        val feed = listOf(
            news("old", "2026-10-01T08:00:00.000Z"),
            news("new", "2026-10-03T08:00:00.000Z"),
            news("mid", "2026-10-02T08:00:00.000Z"),
        ).toNewsFeed({ null }, warsaw)
        assertEquals(listOf("new", "mid", "old"), feed.map { it.id })
    }

    @Test
    fun `publication date is taken in the device time zone`() {
        // 23:30 UTC 4 октября — в Варшаве уже 5 октября
        val item = listOf(news("n1", "2026-10-04T23:30:00.000Z")).toNewsFeed({ null }, warsaw).single()
        assertEquals(LocalDate.of(2026, 10, 5), item.date)
    }

    @Test
    fun `image is decoded only when the news has one`() {
        val decoded = mutableListOf<String>()
        listOf(
            news("with", "2026-10-02T08:00:00.000Z", imageUrl = "data:image/jpeg;base64,AAAA"),
            news("without", "2026-10-01T08:00:00.000Z"),
        ).toNewsFeed({ decoded += it; null }, warsaw)
        assertEquals(listOf("data:image/jpeg;base64,AAAA"), decoded)
    }

    @Test
    fun `news with a category unknown to this version is skipped`() {
        val feed = listOf(
            news("known", "2026-10-01T08:00:00.000Z"),
            news("unknown", "2026-10-02T08:00:00.000Z", category = "PROMOCJA"),
        ).toNewsFeed({ null }, warsaw)
        assertEquals(listOf("known"), feed.map { it.id })
    }

    @Test
    fun `empty feed stays empty`() {
        assertTrue(emptyList<NewsDto>().toNewsFeed({ null }, warsaw).isEmpty())
    }
}
