package com.beauty4you.client.ui.booking

import androidx.compose.ui.graphics.Color
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.Category
import com.beauty4you.client.data.DaySlots
import com.beauty4you.client.data.Master
import com.beauty4you.client.data.Service
import com.beauty4you.client.data.Slot
import com.beauty4you.client.ui.BookingDraft
import com.beauty4you.client.ui.WeekSlots
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class BookingLogicTest {

    // Суббота 3.10.2026 — неделя пн 28.09 … вс 4.10
    private val today = LocalDate.of(2026, 10, 3)

    private fun service(id: String) = Service(id, "c1", id, durationMin = 60, price = 100.0, emoji = "")
    private fun master(id: String, vararg services: String) =
        Master(id, id, Color.Black, photo = null, specialty = "", serviceIds = services.toList())

    // manicure — у Olgi и Anny, pedicure — только у Olgi, strzyzenie — только у Darii
    private val catalog = Catalog(
        salonName = "B4U",
        categories = listOf(Category("c1", "Kat")),
        services = listOf(service("manicure"), service("pedicure"), service("strzyzenie")),
        masters = listOf(
            master("olga", "manicure", "pedicure"),
            master("anna", "manicure"),
            master("daria", "strzyzenie"),
        ),
    )

    private val slot = Slot("2026-10-03T13:00:00.000Z", LocalTime.of(13, 0))

    private fun draft(service: String?, masterId: String?) = BookingDraft(
        serviceId = service,
        masterId = masterId,
        weekStart = weekStartOf(today),
        date = today,
        week = WeekSlots.Ready(mapOf(today to DaySlots(true, listOf(slot)))),
        selectedSlot = slot,
    )

    // --- Фильтры мастер ↔ услуга ---

    @Test
    fun `masters are filtered by selected service`() {
        assertEquals(listOf("olga", "anna"), bookableMasters(catalog, "manicure", null).map { it.id })
        assertEquals(listOf("olga"), bookableMasters(catalog, "pedicure", null).map { it.id })
    }

    @Test
    fun `without service only the master from the card is shown`() {
        assertEquals(listOf("olga"), bookableMasters(catalog, null, "olga").map { it.id })
        assertTrue(bookableMasters(catalog, null, null).isEmpty())
    }

    @Test
    fun `entry from master card narrows services to master's services`() {
        assertEquals(listOf("manicure", "pedicure"), bookableServices(catalog, "olga").map { it.id })
        assertEquals(3, bookableServices(catalog, null).size)
    }

    @Test
    fun `services are ordered by category like the Uslugi tab`() {
        val mixed = catalog.copy(
            categories = listOf(Category("nails", "Paznokcie"), Category("hair", "Włosy")),
            services = listOf(
                service("strzyzenie").copy(categoryId = "hair"),
                service("manicure").copy(categoryId = "nails"),
                service("pedicure").copy(categoryId = "nails"),
            ),
        )
        assertEquals(listOf("manicure", "pedicure", "strzyzenie"), bookableServices(mixed, null).map { it.id })
    }

    @Test
    fun `entry from service preselects it and the only master`() {
        val d = newBookingDraft(catalog, "strzyzenie", null, fromMaster = false, today)
        assertEquals("strzyzenie", d.serviceId)
        assertEquals("daria", d.masterId)
        assertNull(d.narrowToMasterId)
    }

    @Test
    fun `entry from service with several masters leaves master unselected`() {
        val d = newBookingDraft(catalog, "manicure", null, fromMaster = false, today)
        assertEquals("manicure", d.serviceId)
        assertNull(d.masterId)
    }

    @Test
    fun `entry from master card preselects master and its only service`() {
        val d = newBookingDraft(catalog, null, "anna", fromMaster = true, today)
        assertEquals("anna", d.masterId)
        assertEquals("anna", d.narrowToMasterId)
        assertEquals("manicure", d.serviceId)
    }

    @Test
    fun `entry from master card with several services keeps service unselected`() {
        val d = newBookingDraft(catalog, null, "olga", fromMaster = true, today)
        assertEquals("olga", d.masterId)
        assertNull(d.serviceId)
    }

    @Test
    fun `service not offered by narrowed master is ignored`() {
        val d = newBookingDraft(catalog, "strzyzenie", "anna", fromMaster = true, today)
        assertEquals("manicure", d.serviceId)
        assertEquals("anna", d.masterId)
    }

    @Test
    fun `changing service keeps master who offers it, otherwise picks the only one`() {
        val d = draft("manicure", "olga")
        assertEquals("olga", d.withService(catalog, "pedicure").masterId)
        assertEquals("daria", d.withService(catalog, "strzyzenie").masterId)
        assertNull(draft("strzyzenie", "daria").withService(catalog, "manicure").masterId)
    }

    // --- Сброс времени при смене выбора ---

    @Test
    fun `changing service resets time and slots`() {
        val d = draft("manicure", "olga").withService(catalog, "pedicure")
        assertNull(d.selectedSlot)
        assertNull(d.week)
    }

    @Test
    fun `changing master resets time and slots`() {
        val d = draft("manicure", "olga").withMaster("anna")
        assertNull(d.selectedSlot)
        assertNull(d.week)
    }

    @Test
    fun `changing date resets only time`() {
        val before = draft("manicure", "olga")
        val d = before.withDate(today.plusDays(1))
        assertNull(d.selectedSlot)
        assertEquals(before.week, d.week)
        assertEquals("olga", d.masterId)
    }

    @Test
    fun `changing week resets date and time`() {
        val d = draft("manicure", "olga").withWeek(weekStartOf(today).plusWeeks(1))
        assertNull(d.date)
        assertNull(d.selectedSlot)
        assertNull(d.week)
    }

    // --- Доступность кнопки ---

    @Test
    fun `confirm is enabled only when everything is selected`() {
        assertTrue(draft("manicure", "olga").canConfirm)
        assertFalse(draft(null, "olga").canConfirm)
        assertFalse(draft("manicure", null).canConfirm)
        assertFalse(draft("manicure", "olga").copy(date = null).canConfirm)
        assertFalse(draft("manicure", "olga").copy(selectedSlot = null).canConfirm)
    }

    @Test
    fun `confirm is disabled while submitting`() {
        assertFalse(draft("manicure", "olga").copy(submitting = true).canConfirm)
    }

    // --- Неделя календаря ---

    @Test
    fun `week starts on monday and has seven days`() {
        val start = weekStartOf(today)
        assertEquals(LocalDate.of(2026, 9, 28), start)
        assertEquals(LocalDate.of(2026, 10, 4), weekDays(start).last())
        assertEquals(start, weekStartOf(LocalDate.of(2026, 9, 28)))
    }

    @Test
    fun `cannot go back past current week`() {
        val current = weekStartOf(today)
        assertFalse(canGoToPreviousWeek(current, today))
        assertTrue(canGoToPreviousWeek(current.plusWeeks(1), today))
    }

    @Test
    fun `past days are not selectable`() {
        assertFalse(isDaySelectable(today.minusDays(1), today, null))
        assertTrue(isDaySelectable(today, today, null))
    }

    @Test
    fun `master's day off is not selectable`() {
        val sunday = today.plusDays(1)
        val week = WeekSlots.Ready(mapOf(today to DaySlots(true, emptyList()), sunday to DaySlots(false, emptyList())))
        assertTrue(isDaySelectable(today, today, week))
        assertFalse(isDaySelectable(sunday, today, week))
    }

    @Test
    fun `date pick keeps valid choice, otherwise first day with free slots`() {
        val sunday = today.plusDays(1)
        val days = mapOf(today to DaySlots(true, emptyList()), sunday to DaySlots(true, listOf(slot)))
        assertEquals(today, pickDate(today, days, today))
        assertEquals(sunday, pickDate(null, days, today))
        val offSunday = mapOf(today to DaySlots(true, emptyList()), sunday to DaySlots(false, emptyList()))
        assertEquals(today, pickDate(sunday, offSunday, today))
        assertNull(pickDate(null, mapOf(today to DaySlots(false, emptyList())), today))
    }
}
