package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class CatalogEditLogicTest {

    private val photo = "data:image/jpeg;base64,AAAA"
    private val categoryOrder = listOf("c1", "c2", "c3")

    private fun master(
        name: String = "Anna",
        categoryIds: List<String> = listOf("c1"),
        serviceIds: Set<String> = setOf("s1"),
        isActive: Boolean = true,
        photo: String? = null,
    ) = Master(id = "m1", name = name, photo = photo, isActive = isActive, serviceIds = serviceIds, categoryIds = categoryIds)

    private fun service(categoryId: String = "c1", price: String = "150.00", durationMin: Int = 60) =
        Service(id = "s1", name = "Manicure", categoryId = categoryId, durationMin = durationMin, price = price)

    // --- Мастер: проверки полей ---

    @Test
    fun `master needs a name and at least one specialization like the backend DTO`() {
        assertEquals(
            setOf(MasterFieldError.NAME_EMPTY, MasterFieldError.NO_SPECIALIZATION),
            CatalogEditLogic.validate(MasterForm(name = "   ")),
        )
        assertTrue(CatalogEditLogic.validate(MasterForm(name = "Anna", categoryIds = setOf("c1"))).isEmpty())
    }

    @Test
    fun `toggle adds and removes an id`() {
        assertEquals(setOf("a", "b"), CatalogEditLogic.toggle(setOf("a"), "b"))
        assertEquals(setOf("a"), CatalogEditLogic.toggle(setOf("a", "b"), "b"))
    }

    // --- Мастер: план сохранения ---

    @Test
    fun `new master is created then photo uploaded and services assigned`() {
        val form = MasterForm(
            name = "  Ola ",
            categoryIds = setOf("c3", "c1"),
            serviceIds = setOf("s2", "s1"),
            photo = MasterPhotoState.Picked(photo),
        )
        val plan = CatalogEditLogic.planSave(null, form, categoryOrder)

        assertEquals(MasterFields(name = "Ola", categoryIds = listOf("c1", "c3")), plan.create)
        assertNull(plan.patch)
        assertEquals(photo, plan.uploadPhoto)
        assertEquals(listOf("s1", "s2"), plan.assign)
        assertTrue(plan.unassign.isEmpty())
    }

    @Test
    fun `unchanged master is a noop`() {
        val original = master(photo = photo)
        assertTrue(CatalogEditLogic.planSave(original, CatalogEditLogic.fromMaster(original), categoryOrder).isNoop)
    }

    @Test
    fun `edit sends only changed fields and diffs services`() {
        val original = master(categoryIds = listOf("c1", "c2"), serviceIds = setOf("s1", "s2"))
        val form = CatalogEditLogic.fromMaster(original).copy(
            categoryIds = setOf("c2", "c1"), // тот же набор в другом порядке — не изменение
            serviceIds = setOf("s2", "s3"),
            isActive = false,
        )
        val plan = CatalogEditLogic.planSave(original, form, categoryOrder)

        assertNull(plan.create)
        assertEquals(MasterFields(isActive = false), plan.patch)
        assertEquals(listOf("s3"), plan.assign)
        assertEquals(listOf("s1"), plan.unassign)
        assertNull(plan.uploadPhoto)
        assertFalse(plan.removePhoto)
    }

    @Test
    fun `rename and new specialization go into one patch`() {
        val original = master()
        val form = CatalogEditLogic.fromMaster(original).copy(name = "Anna K.", categoryIds = setOf("c1", "c2"))
        assertEquals(
            MasterFields(name = "Anna K.", categoryIds = listOf("c1", "c2")),
            CatalogEditLogic.planSave(original, form, categoryOrder).patch,
        )
    }

    @Test
    fun `removing a saved photo deletes it on the server, removing nothing does not`() {
        val withPhoto = master(photo = photo)
        val removed = CatalogEditLogic.fromMaster(withPhoto).copy(photo = MasterPhotoState.Removed)
        assertTrue(CatalogEditLogic.planSave(withPhoto, removed, categoryOrder).removePhoto)

        val withoutPhoto = master(photo = null)
        val alsoRemoved = CatalogEditLogic.fromMaster(withoutPhoto).copy(photo = MasterPhotoState.Removed)
        assertFalse(CatalogEditLogic.planSave(withoutPhoto, alsoRemoved, categoryOrder).removePhoto)
    }

    @Test
    fun `retry after create continues from the created master without creating a duplicate`() {
        val form = MasterForm(name = "Ola", categoryIds = setOf("c1"), serviceIds = setOf("s1", "s2"))
        // POST /staff прошёл, привязка s2 упала — в форме теперь созданный мастер с s1
        val created = master(name = "Ola", serviceIds = setOf("s1"))
        val plan = CatalogEditLogic.planSave(created, form, categoryOrder)

        assertNull(plan.create)
        assertNull(plan.patch)
        assertEquals(listOf("s2"), plan.assign)
    }

    @Test
    fun `photo size limit is the server one - 2 MB after base64 decoding`() {
        val limit = CatalogEditLogic.PHOTO_MAX_BYTES
        val fits = "data:image/jpeg;base64," + "A".repeat(limit / 3 * 4)
        val tooBig = "data:image/jpeg;base64," + "A".repeat((limit / 3 + 1) * 4)
        assertFalse(CatalogEditLogic.photoTooLarge(fits))
        assertTrue(CatalogEditLogic.photoTooLarge(tooBig))
    }

    @Test
    fun `masters list keeps inactive at the end, alphabetically inside`() {
        val list = listOf(
            Master(id = "1", name = "zofia"),
            Master(id = "2", name = "Basia", isActive = false),
            Master(id = "3", name = "Anna"),
        )
        assertEquals(listOf("3", "1", "2"), CatalogEditLogic.sortedMasters(list).map { it.id })
    }

    // --- Услуга ---

    @Test
    fun `price accepts polish comma, spaces and up to two decimals`() {
        assertEquals(BigDecimal("150"), CatalogEditLogic.parsePrice("150"))
        assertEquals(BigDecimal("99.50"), CatalogEditLogic.parsePrice(" 99,50 "))
        assertEquals(BigDecimal("1200"), CatalogEditLogic.parsePrice("1 200"))
        assertEquals(BigDecimal("0"), CatalogEditLogic.parsePrice("0"))
        assertNull(CatalogEditLogic.parsePrice("9,999"))
        assertNull(CatalogEditLogic.parsePrice("-5"))
        assertNull(CatalogEditLogic.parsePrice("abc"))
        assertNull(CatalogEditLogic.parsePrice(""))
        assertNull(CatalogEditLogic.parsePrice("100000000"))
    }

    @Test
    fun `duration is a whole number of minutes from 1 to a day`() {
        assertEquals(45, CatalogEditLogic.parseDuration("45"))
        assertNull(CatalogEditLogic.parseDuration("0"))
        assertNull(CatalogEditLogic.parseDuration(""))
        assertNull(CatalogEditLogic.parseDuration("1441"))
    }

    @Test
    fun `price from the backend is shown in an editable polish form`() {
        assertEquals("150", CatalogEditLogic.priceInput("150.00"))
        assertEquals("99,50", CatalogEditLogic.priceInput("99.50"))
        assertEquals("99,50", CatalogEditLogic.priceInput("99.5"))
        assertEquals("1200", CatalogEditLogic.priceInput("1200.00"))
    }

    @Test
    fun `service form validation reports every broken field`() {
        val errors = CatalogEditLogic.validate(ServiceForm(categoryId = "gone", name = " ", duration = "0", price = "x"), setOf("c1"))
        assertEquals(ServiceFieldError.entries.toSet(), errors)
        assertTrue(CatalogEditLogic.validate(ServiceForm("c1", "Manicure", "60", "150"), setOf("c1")).isEmpty())
    }

    @Test
    fun `new service sends all fields`() {
        assertEquals(
            ServiceFields("Manicure", "c1", 60, BigDecimal("99.50")),
            CatalogEditLogic.serviceFields(null, ServiceForm("c1", " Manicure ", "60", "99,50")),
        )
    }

    @Test
    fun `edited service sends only changed fields, price compared by value`() {
        val original = service(price = "150.00")
        val same = CatalogEditLogic.fromService(original)
        assertNull(CatalogEditLogic.serviceFields(original, same))
        assertNull(CatalogEditLogic.serviceFields(original, same.copy(price = "150,0")))
        assertEquals(
            ServiceFields(categoryId = "c2", price = BigDecimal("160")),
            CatalogEditLogic.serviceFields(original, same.copy(categoryId = "c2", price = "160")),
        )
    }

    @Test
    fun `services are grouped under all categories including empty ones, orphans last`() {
        val categories = listOf(Category("c2", "Rzęsy"), Category("c1", "Manicure"))
        val services = listOf(
            Service("s2", "Pedicure", "c1", 60, "100"),
            Service("s1", "Hybryda", "c1", 60, "100"),
            Service("s3", "Stara", "gone", 30, "50"),
        )
        val groups = CatalogEditLogic.groupServices(categories, services)

        assertEquals(listOf("c1", "c2", null), groups.map { it.first?.id })
        assertEquals(listOf("s1", "s2"), groups[0].second.map { it.id })
        assertTrue(groups[1].second.isEmpty())
        assertEquals(listOf("s3"), groups[2].second.map { it.id })
    }

    // --- Категория ---

    @Test
    fun `category name must be non-empty and unique ignoring case`() {
        val categories = listOf(Category("c1", "Manicure"), Category("c2", "Rzęsy"))
        assertEquals(setOf(CategoryFieldError.NAME_EMPTY), CatalogEditLogic.validateCategory("  ", categories, null))
        assertEquals(setOf(CategoryFieldError.NAME_TAKEN), CatalogEditLogic.validateCategory(" manicure ", categories, null))
        // Переименование самой себя (смена регистра) — не дубликат
        assertTrue(CatalogEditLogic.validateCategory("MANICURE", categories, "c1").isEmpty())
    }

    @Test
    fun `only an empty non-default category can be deleted`() {
        val services = listOf(service(categoryId = "c1"))
        assertEquals(CategoryDeleteBlock.DEFAULT, CatalogEditLogic.categoryDeleteBlock(Category("c0", "Inne", isDefault = true), emptyList()))
        assertEquals(CategoryDeleteBlock.HAS_SERVICES, CatalogEditLogic.categoryDeleteBlock(Category("c1", "Manicure"), services))
        assertNull(CatalogEditLogic.categoryDeleteBlock(Category("c2", "Rzęsy"), services))
    }

    // --- Ошибки бэкенда: тексты из StaffService / ServicesService / ServiceCategoriesService ---

    @Test
    fun `backend errors map to form messages`() {
        assertEquals(CatalogError.NETWORK, CatalogEditLogic.mapError(null, "timeout"))
        assertEquals(
            CatalogError.MASTER_HAS_BOOKINGS,
            CatalogEditLogic.mapError(409, "Нельзя деактивировать мастера с активными записями — сначала отмените или перенесите их"),
        )
        assertEquals(
            CatalogError.SERVICE_IN_USE,
            CatalogEditLogic.mapError(409, "Cannot delete a service that is still referenced by masters, materials, or bookings"),
        )
        assertEquals(
            CatalogError.CATEGORY_DEFAULT,
            CatalogEditLogic.mapError(409, "Cannot delete the default category — mark a different category as default first"),
        )
        assertEquals(CatalogError.PHOTO_INVALID, CatalogEditLogic.mapError(400, "Photo must not exceed 2MB"))
        assertEquals(CatalogError.VALIDATION, CatalogEditLogic.mapError(400, "Invalid categoryId"))
        assertEquals(CatalogError.NOT_FOUND, CatalogEditLogic.mapError(404, "Master not found"))
        assertEquals(CatalogError.UNKNOWN, CatalogEditLogic.mapError(500, null))
    }
}
