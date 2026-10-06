package com.beauty4you.admin.domain

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime

// «Odrzucić zmiany?» (item76): спрашиваем, только когда форма действительно изменена.
// График и блокировки — в ScheduleLogicTest / BlockLogicTest.
class FormDirtinessTest {

    @Test
    fun `news - empty new form and untouched post are clean, real edits are dirty`() {
        assertFalse(NewsFormLogic.isDirty(null, NewsForm()))
        assertFalse(NewsFormLogic.isDirty(null, NewsForm(title = "   ")))
        assertTrue(NewsFormLogic.isDirty(null, NewsForm(title = "Nowość")))
        assertTrue(NewsFormLogic.isDirty(null, NewsForm(image = NewsImage.Picked("data:image/jpeg;base64,AAAA"))))

        val post = NewsPost("n1", NewsCategory.NOWOSC, "Tytuł", "Treść", null, NewsStatus.DRAFT, null, Instant.EPOCH)
        val form = NewsFormLogic.fromPost(post)
        assertFalse(NewsFormLogic.isDirty(post, form))
        assertFalse(NewsFormLogic.isDirty(post, form.copy(title = "Tytuł ")))
        assertTrue(NewsFormLogic.isDirty(post, form.copy(status = NewsStatus.PUBLISHED)))
    }

    @Test
    fun `master - new and untouched forms are clean, edits are dirty`() {
        assertFalse(CatalogEditLogic.isDirty(null, MasterForm()))
        assertFalse(CatalogEditLogic.isDirty(null, MasterForm(name = "  ")))
        assertTrue(CatalogEditLogic.isDirty(null, MasterForm(categoryIds = setOf("c1"))))

        val master = Master("m1", "Anna", categoryIds = listOf("c1"), serviceIds = setOf("s1"))
        val form = CatalogEditLogic.fromMaster(master)
        assertFalse(CatalogEditLogic.isDirty(master, form))
        assertTrue(CatalogEditLogic.isDirty(master, form.copy(serviceIds = emptySet())))
        assertTrue(CatalogEditLogic.isDirty(master, form.copy(isActive = false)))
        assertTrue(CatalogEditLogic.isDirty(master, form.copy(photo = MasterPhotoState.Removed)))
    }

    @Test
    fun `service - preselected category alone is not a change`() {
        val initial = ServiceForm(categoryId = "c1")
        assertFalse(CatalogEditLogic.isDirty(initial, initial))
        assertFalse(CatalogEditLogic.isDirty(initial, initial.copy(name = " ")))
        assertTrue(CatalogEditLogic.isDirty(initial, initial.copy(price = "100")))
        assertTrue(CatalogEditLogic.isDirty(initial, initial.copy(categoryId = "c2")))
    }

    @Test
    fun `category - only a different name counts`() {
        assertFalse(CatalogEditLogic.isCategoryDirty(null, ""))
        assertTrue(CatalogEditLogic.isCategoryDirty(null, "Rzęsy"))
        val category = Category("c1", "Manicure")
        assertFalse(CatalogEditLogic.isCategoryDirty(category, "Manicure "))
        assertTrue(CatalogEditLogic.isCategoryDirty(category, "Manicure hybrydowy"))
    }

    @Test
    fun `booking - any changed field makes the form dirty`() {
        val initial = BookingDraft("c1", null, null, LocalDate.of(2026, 10, 6), null, BookingStatus.CONFIRMED)
        assertFalse(BookingFormLogic.isDirty(initial, initial))
        assertTrue(BookingFormLogic.isDirty(initial, initial.copy(masterId = "m1")))
        assertTrue(BookingFormLogic.isDirty(initial, initial.copy(time = LocalTime.of(10, 0))))
        assertTrue(BookingFormLogic.isDirty(initial, initial.copy(date = initial.date.plusDays(1))))
    }
}
