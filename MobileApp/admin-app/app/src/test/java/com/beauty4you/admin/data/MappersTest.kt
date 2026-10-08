package com.beauty4you.admin.data

import com.beauty4you.admin.data.remote.BookingDto
import com.beauty4you.admin.data.remote.ClientDto
import com.beauty4you.admin.data.remote.NewsBody
import com.beauty4you.admin.data.remote.NewsPostDto
import com.beauty4you.admin.data.remote.toBody
import com.beauty4you.admin.data.remote.ScheduleDayDto
import com.beauty4you.admin.data.remote.ServiceDto
import com.beauty4you.admin.data.remote.StaffDto
import com.beauty4you.admin.data.remote.StaffServiceDto
import com.beauty4you.admin.data.remote.parseNestErrorMessage
import com.beauty4you.admin.data.remote.parseSalonTime
import com.beauty4you.admin.data.remote.toDomain
import com.beauty4you.admin.domain.BookingSource
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.domain.NewsCategory
import com.beauty4you.admin.domain.NewsFields
import com.beauty4you.admin.domain.NewsStatus
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class MappersTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `salon time is read as is, without device time zone conversion`() {
        assertEquals(LocalDateTime.of(2026, 10, 5, 9, 0), parseSalonTime("2026-10-05T09:00:00.000Z"))
    }

    @Test
    fun `booking dto maps status and source`() {
        val dto = BookingDto("b1", "c1", "m1", "s1", "2026-10-05T09:00:00.000Z", "2026-10-05T09:45:00.000Z", "CONFIRMED", "ONLINE")
        val booking = dto.toDomain()!!
        assertEquals(BookingStatus.CONFIRMED, booking.status)
        assertEquals(BookingSource.ONLINE, booking.source)
        assertEquals(LocalDateTime.of(2026, 10, 5, 9, 45), booking.end)
    }

    @Test
    fun `booking with a status unknown to this version is skipped`() {
        assertNull(BookingDto("b1", "c1", "m1", "s1", "2026-10-05T09:00:00.000Z", "2026-10-05T09:45:00.000Z", "ARCHIVED").toDomain())
    }

    @Test
    fun `no-show booking maps to NO_SHOW (item74)`() {
        val dto = BookingDto("b1", "c1", "m1", "s1", "2026-10-05T09:00:00.000Z", "2026-10-05T09:45:00.000Z", "NO_SHOW")
        assertEquals(BookingStatus.NO_SHOW, dto.toDomain()!!.status)
    }

    // item74 — флаг «Niewiarygodny» считает бэкенд: 2 неявки — без метки, 3 — с меткой
    @Test
    fun `client no-show count and unreliable flag are decoded from the API`() {
        val two = json.decodeFromString<ClientDto>(
            """{"id":"c1","name":"Anna","phone":"+48601234567","noShowCount":2,"unreliable":false,"tags":[]}""",
        ).toDomain()
        val three = json.decodeFromString<ClientDto>(
            """{"id":"c2","name":"Ola","phone":"+48601234568","noShowCount":3,"unreliable":true}""",
        ).toDomain()
        assertEquals(2, two.noShowCount)
        assertFalse(two.unreliable)
        assertEquals(3, three.noShowCount)
        assertTrue(three.unreliable)
    }

    @Test
    fun `client without the flags (POST clients response) is reliable`() {
        val client = json
            .decodeFromString<ClientDto>("""{"id":"c1","name":"Anna","phone":"+48601234567"}""")
            .toDomain()
        assertEquals(0, client.noShowCount)
        assertFalse(client.unreliable)
    }

    @Test
    fun `decimal price string is kept`() {
        assertEquals("150.00", ServiceDto("s1", "Cut", "cat", 60, JsonPrimitive("150.00")).toDomain().price)
        assertEquals("99.5", ServiceDto("s1", "Cut", "cat", 60, JsonPrimitive(99.5)).toDomain().price)
    }

    @Test
    fun `staff services become a set of ids`() {
        val master = StaffDto("m1", "Maria", services = listOf(StaffServiceDto("s1"), StaffServiceDto("s2"))).toDomain()
        assertEquals(setOf("s1", "s2"), master.serviceIds)
    }

    @Test
    fun `staff canDelete is mapped and defaults to false`() {
        assertEquals(true, StaffDto("m1", "Maria", canDelete = true).toDomain().canDelete)
        assertEquals(false, StaffDto("m2", "Olga", canDelete = false).toDomain().canDelete)
        assertEquals(false, StaffDto("m3", "Ewa").toDomain().canDelete)
    }

    @Test
    fun `schedule day parses date-only and hours`() {
        val day = ScheduleDayDto("m1", "2026-10-05T00:00:00.000Z", true, "10:00", "17:30").toDomain()
        assertEquals(LocalDate.of(2026, 10, 5), day.date)
        assertEquals(LocalTime.of(10, 0), day.startTime)
        assertEquals(LocalTime.of(17, 30), day.endTime)
    }

    @Test
    fun `nest error message is extracted from string or array`() {
        assertEquals(
            "Master already has an overlapping booking at this time",
            parseNestErrorMessage("""{"message":"Master already has an overlapping booking at this time","error":"Conflict","statusCode":409}"""),
        )
        assertEquals(
            "a; b",
            parseNestErrorMessage("""{"message":["a","b"],"error":"Bad Request","statusCode":400}"""),
        )
        assertNull(parseNestErrorMessage("<html>"))
        assertNull(parseNestErrorMessage(null))
    }

    // --- Новости (item75) ---

    @Test
    fun `news post is decoded from the GET news response`() {
        val dto = json.decodeFromString<NewsPostDto>(
            """{"id":"n1","salonId":"s1","category":"INSPIRACJA","title":"Trendy","body":"Treść",
               "imageUrl":"data:image/jpeg;base64,AAAA","status":"PUBLISHED",
               "publishedAt":"2026-10-03T08:15:00.000Z","createdAt":"2026-10-02T08:00:00.000Z","updatedAt":"2026-10-03T08:15:00.000Z"}""",
        )
        val post = dto.toDomain()!!
        assertEquals(NewsCategory.INSPIRACJA, post.category)
        assertEquals(NewsStatus.PUBLISHED, post.status)
        assertEquals("data:image/jpeg;base64,AAAA", post.imageUrl)
        assertEquals(Instant.parse("2026-10-03T08:15:00Z"), post.publishedAt)
        assertEquals(Instant.parse("2026-10-02T08:00:00Z"), post.createdAt)
    }

    @Test
    fun `draft without image and publication date is decoded`() {
        val post = json.decodeFromString<NewsPostDto>(
            """{"id":"n1","category":"NOWOSC","title":"T","body":"B","imageUrl":null,"status":"DRAFT","publishedAt":null,"createdAt":"2026-10-02T08:00:00.000Z"}""",
        ).toDomain()!!
        assertEquals(NewsStatus.DRAFT, post.status)
        assertNull(post.imageUrl)
        assertNull(post.publishedAt)
    }

    @Test
    fun `news with a category or status unknown to this version is skipped`() {
        val base = NewsPostDto("n1", "NOWOSC", "T", "B", null, "DRAFT", null, "2026-10-02T08:00:00.000Z")
        assertNull(base.copy(category = "PROMOCJA").toDomain())
        assertNull(base.copy(status = "ARCHIVED").toDomain())
    }

    @Test
    fun `news fields map to the request body, unchanged fields stay null`() {
        assertEquals(
            NewsBody(category = "DIGEST", title = "T", body = "B", status = "PUBLISHED"),
            NewsFields(NewsCategory.DIGEST, "T", "B", NewsStatus.PUBLISHED).toBody(),
        )
        assertEquals(NewsBody(status = "DRAFT"), NewsFields(status = NewsStatus.DRAFT).toBody())
    }

    // PATCH отправляет только изменённые поля: null-поля в JSON не попадают (explicitNulls = false, как в NetworkModule)
    @Test
    fun `patch body omits unchanged fields`() {
        val network = Json { explicitNulls = false }
        assertEquals("""{"title":"Nowy"}""", network.encodeToString(NewsBody.serializer(), NewsBody(title = "Nowy")))
    }

    @Test
    fun `news post carries hasArticle and defaults to false for older backends`() {
        val with = json.decodeFromString<NewsPostDto>(
            """{"id":"n1","category":"NOWOSC","title":"T","body":"B","status":"DRAFT","createdAt":"2026-10-01T10:00:00.000Z","hasArticle":true}""",
        ).toDomain()!!
        val without = json.decodeFromString<NewsPostDto>(
            """{"id":"n1","category":"NOWOSC","title":"T","body":"B","status":"DRAFT","createdAt":"2026-10-01T10:00:00.000Z"}""",
        ).toDomain()!!
        assertEquals(true, with.hasArticle)
        assertEquals(false, without.hasArticle)
    }

    @Test
    fun `contentHtml is sent only when set, empty string means delete`() {
        assertEquals(null, NewsFields(title = "T").toBody().contentHtml)
        assertEquals("<p>x</p>", NewsFields(contentHtml = "<p>x</p>").toBody().contentHtml)
        assertEquals("", NewsFields(contentHtml = "").toBody().contentHtml)
        // null не попадает в JSON (explicitNulls = false в NetworkModule), "" — попадает
        val encoder = kotlinx.serialization.json.Json { explicitNulls = false }
        assertEquals("""{"title":"T"}""", encoder.encodeToString(NewsBody.serializer(), NewsFields(title = "T").toBody()))
        assertEquals("""{"contentHtml":""}""", encoder.encodeToString(NewsBody.serializer(), NewsFields(contentHtml = "").toBody()))
    }
}
