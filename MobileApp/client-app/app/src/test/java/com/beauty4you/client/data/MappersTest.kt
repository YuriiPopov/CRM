package com.beauty4you.client.data

import com.beauty4you.client.data.remote.BookingDto
import com.beauty4you.client.data.remote.CatalogDto
import com.beauty4you.client.data.remote.CategoryDto
import com.beauty4you.client.data.remote.ClientCatalogDto
import com.beauty4you.client.data.remote.ClientServiceDto
import com.beauty4you.client.data.remote.MasterDto
import com.beauty4you.client.data.remote.ApiJson
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
    fun `catalog carries photoCount and coverPhotoId, services without photos have none`() {
        val dto = CatalogDto(
            salon = SalonDto("B4U"),
            categories = listOf(CategoryDto("c1", "Massage")),
            services = listOf(
                ServiceDto("s1", "Relax", "c1", 30, 99.5, photoCount = 3, coverPhotoId = "p1"),
                ServiceDto("s2", "Plain", "c1", 30, 50.0),
            ),
            masters = emptyList(),
        )

        val catalog = dto.toDomain(decodePhoto = { null })

        assertEquals(3, catalog.service("s1")!!.photoCount)
        assertEquals("p1", catalog.service("s1")!!.coverPhotoId)
        assertTrue(catalog.service("s1")!!.hasPhotos)
        assertEquals(0, catalog.service("s2")!!.photoCount)
        assertNull(catalog.service("s2")!!.coverPhotoId)
        assertFalse(catalog.service("s2")!!.hasPhotos)
    }

    @Test
    fun `catalog json without photo fields still parses (older backend)`() {
        val dto = com.beauty4you.client.data.remote.ApiJson.decodeFromString<ServiceDto>(
            """{"id":"s1","name":"Relax","categoryId":"c1","durationMin":30,"price":99.5}""",
        )
        assertEquals(0, dto.photoCount)
        assertNull(dto.coverPhotoId)
    }

    @Test
    fun `catalog maps category cover, master specializations and client history`() {
        val dto = CatalogDto(
            salon = SalonDto("B4U"),
            categories = listOf(CategoryDto("c1", "Paznokcie", coverPhotoId = "p1"), CategoryDto("c2", "Włosy")),
            services = listOf(ServiceDto("s1", "Manicure", "c1", 60, 100.0)),
            masters = listOf(MasterDto("m1", "Olga", null, listOf("s1"), listOf("Paznokcie"), specializationCategoryIds = listOf("c1"))),
            client = ClientCatalogDto(false, listOf(ClientServiceDto("s1", "m1", "2026-09-30T09:00:00.000Z"))),
        )

        val catalog = dto.toDomain { null }

        assertEquals("p1", catalog.categories[0].coverPhotoId)
        assertNull(catalog.categories[1].coverPhotoId)
        assertEquals(listOf("c1"), catalog.masters[0].specializationCategoryIds)
        assertFalse(catalog.isNewClient)
        assertEquals(ClientServiceVisit("s1", "m1", LocalDateTime.of(2026, 9, 30, 9, 0)), catalog.clientServices.single())
    }

    @Test
    fun `catalog without client block is treated as new client`() {
        val dto = CatalogDto(SalonDto("B4U"), emptyList(), emptyList(), emptyList())

        val catalog = dto.toDomain { null }

        assertTrue(catalog.isNewClient)
        assertTrue(catalog.clientServices.isEmpty())
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
        hasArticle: Boolean = false,
    ) = NewsDto(id = id, category = category, title = "Tytuł $id", body = "Treść $id", imageUrl = imageUrl, publishedAt = publishedAt, hasArticle = hasArticle)

    @Test
    fun `news feed carries hasArticle and defaults to false for older responses`() {
        val feed = listOf(
            news("with", "2026-10-03T08:15:00.000Z", hasArticle = true),
            news("without", "2026-10-02T08:15:00.000Z"),
        ).toNewsFeed({ _, _ -> null }, warsaw)

        assertEquals(listOf(true, false), feed.map { it.hasArticle })
        // ответ без поля hasArticle (старый backend) разбирается как «без статьи»
        val old = """{"id":"n","category":"NOWOSC","title":"T","body":"B","publishedAt":"2026-10-03T08:15:00.000Z"}"""
        assertEquals(false, ApiJson.decodeFromString<NewsDto>(old).hasArticle)
    }

    @Test
    fun `news feed maps title, text, category tag and publication date`() {
        val item = listOf(news("n1", "2026-10-03T08:15:00.000Z", category = "INSPIRACJA")).toNewsFeed({ _, _ -> null }, warsaw).single()

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
            .toNewsFeed({ _, _ -> null }, warsaw)
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
        ).toNewsFeed({ _, _ -> null }, warsaw)
        assertEquals(listOf("new", "mid", "old"), feed.map { it.id })
    }

    @Test
    fun `publication date is taken in the device time zone`() {
        // 23:30 UTC 4 октября — в Варшаве уже 5 октября
        val item = listOf(news("n1", "2026-10-04T23:30:00.000Z")).toNewsFeed({ _, _ -> null }, warsaw).single()
        assertEquals(LocalDate.of(2026, 10, 5), item.date)
    }

    @Test
    fun `image is decoded only when the news has one`() {
        val decoded = mutableListOf<String>()
        listOf(
            news("with", "2026-10-02T08:00:00.000Z", imageUrl = "data:image/jpeg;base64,AAAA"),
            news("without", "2026-10-01T08:00:00.000Z"),
        ).toNewsFeed({ _, dataUrl -> decoded += dataUrl; null }, warsaw)
        assertEquals(listOf("data:image/jpeg;base64,AAAA"), decoded)
    }

    @Test
    fun `news with a category unknown to this version is skipped`() {
        val feed = listOf(
            news("known", "2026-10-01T08:00:00.000Z"),
            news("unknown", "2026-10-02T08:00:00.000Z", category = "PROMOCJA"),
        ).toNewsFeed({ _, _ -> null }, warsaw)
        assertEquals(listOf("known"), feed.map { it.id })
    }

    @Test
    fun `empty feed stays empty`() {
        assertTrue(emptyList<NewsDto>().toNewsFeed({ _, _ -> null }, warsaw).isEmpty())
    }
}
