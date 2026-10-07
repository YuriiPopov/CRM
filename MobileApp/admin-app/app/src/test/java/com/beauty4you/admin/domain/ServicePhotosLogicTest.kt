package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ServicePhotosLogicTest {

    private fun saved(id: String) = ServicePhotoDraft(key = id, serverId = id, dataUrl = "data:image/jpeg;base64,$id")
    private fun fresh(key: String) = ServicePhotoDraft(key = key, serverId = null, dataUrl = "data:image/jpeg;base64,$key")
    private fun keys(photos: List<ServicePhotoDraft>) = photos.map { it.key }

    // --- Лимит и размер ---

    @Test
    fun `at most five photos can be added`() {
        assertTrue(ServicePhotosLogic.canAdd(0))
        assertTrue(ServicePhotosLogic.canAdd(4))
        assertFalse(ServicePhotosLogic.canAdd(5))
        assertFalse(ServicePhotosLogic.canAdd(6))
    }

    @Test
    fun `one megabyte after decoding passes, one byte more is too large`() {
        fun dataUrl(bytes: Int) = "data:image/jpeg;base64," + java.util.Base64.getEncoder().encodeToString(ByteArray(bytes))
        assertFalse(ServicePhotosLogic.tooLarge(dataUrl(ServicePhotosLogic.MAX_BYTES)))
        assertTrue(ServicePhotosLogic.tooLarge(dataUrl(ServicePhotosLogic.MAX_BYTES + 1)))
    }

    // --- Порядок ---

    @Test
    fun `move shifts a photo by one position`() {
        val photos = listOf(saved("a"), saved("b"), saved("c"))
        assertEquals(listOf("b", "a", "c"), keys(ServicePhotosLogic.move(photos, "a", +1)))
        assertEquals(listOf("a", "c", "b"), keys(ServicePhotosLogic.move(photos, "c", -1)))
    }

    @Test
    fun `move at the edge or for an unknown key changes nothing`() {
        val photos = listOf(saved("a"), saved("b"))
        assertEquals(keys(photos), keys(ServicePhotosLogic.move(photos, "a", -1)))
        assertEquals(keys(photos), keys(ServicePhotosLogic.move(photos, "b", +1)))
        assertEquals(keys(photos), keys(ServicePhotosLogic.move(photos, "zzz", +1)))
    }

    @Test
    fun `remove drops only the given photo`() {
        assertEquals(listOf("a", "c"), keys(ServicePhotosLogic.remove(listOf(saved("a"), saved("b"), saved("c")), "b")))
    }

    // --- «Odrzucić zmiany?» ---

    @Test
    fun `untouched photos are not dirty`() {
        val initial = listOf(saved("a"), saved("b"))
        assertFalse(ServicePhotosLogic.isDirty(initial, initial))
        assertFalse(ServicePhotosLogic.isDirty(emptyList(), emptyList()))
    }

    @Test
    fun `adding, removing and reordering make the form dirty`() {
        val initial = listOf(saved("a"), saved("b"))
        assertTrue(ServicePhotosLogic.isDirty(initial, initial + fresh("new-1")))
        assertTrue(ServicePhotosLogic.isDirty(initial, listOf(saved("a"))))
        assertTrue(ServicePhotosLogic.isDirty(initial, listOf(saved("b"), saved("a"))))
    }

    @Test
    fun `moving a photo back to where it was is not dirty`() {
        val initial = listOf(saved("a"), saved("b"))
        val moved = ServicePhotosLogic.move(ServicePhotosLogic.move(initial, "a", +1), "a", -1)
        assertFalse(ServicePhotosLogic.isDirty(initial, moved))
    }

    // --- План сохранения ---

    @Test
    fun `no changes give an empty plan`() {
        val initial = listOf(saved("a"), saved("b"))
        assertTrue(ServicePhotosLogic.planSave(initial, initial).isNoop)
    }

    @Test
    fun `new photos are appended in order without a reorder`() {
        val plan = ServicePhotosLogic.planSave(listOf(saved("a")), listOf(saved("a"), fresh("n1"), fresh("n2")))
        assertEquals(listOf("n1", "n2"), keys(plan.uploads))
        assertTrue(plan.deleteIds.isEmpty())
        assertFalse(plan.reorder)
    }

    @Test
    fun `removing a photo only deletes it - remaining order is kept by the server`() {
        val plan = ServicePhotosLogic.planSave(listOf(saved("a"), saved("b"), saved("c")), listOf(saved("a"), saved("c")))
        assertEquals(listOf("b"), plan.deleteIds)
        assertTrue(plan.uploads.isEmpty())
        assertFalse(plan.reorder)
    }

    @Test
    fun `a swap of saved photos needs a reorder`() {
        val plan = ServicePhotosLogic.planSave(listOf(saved("a"), saved("b")), listOf(saved("b"), saved("a")))
        assertTrue(plan.reorder)
        assertTrue(plan.deleteIds.isEmpty())
        assertTrue(plan.uploads.isEmpty())
    }

    @Test
    fun `a new photo placed in front of saved ones needs a reorder`() {
        val plan = ServicePhotosLogic.planSave(listOf(saved("a")), listOf(fresh("n1"), saved("a")))
        assertEquals(listOf("n1"), keys(plan.uploads))
        assertTrue(plan.reorder)
    }

    @Test
    fun `delete, upload and reorder can be combined`() {
        val initial = listOf(saved("a"), saved("b"), saved("c"))
        val draft = listOf(fresh("n1"), saved("c"), saved("a"))
        val plan = ServicePhotosLogic.planSave(initial, draft)
        assertEquals(listOf("b"), plan.deleteIds)
        assertEquals(listOf("n1"), keys(plan.uploads))
        assertTrue(plan.reorder)
        // сервер выдал новому фото id "srv-1" — порядок для PUT собирается по черновику
        assertEquals(listOf("srv-1", "c", "a"), ServicePhotosLogic.orderIds(draft, mapOf("n1" to "srv-1")))
    }

    @Test
    fun `replacing a photo - delete first so the five photo limit is not hit`() {
        val initial = (1..5).map { saved("p$it") }
        val plan = ServicePhotosLogic.planSave(initial, initial.drop(1) + fresh("n1"))
        assertEquals(listOf("p1"), plan.deleteIds)
        assertEquals(listOf("n1"), keys(plan.uploads))
        assertFalse(plan.reorder)
    }

    @Test
    fun `a new service with photos uploads them all in order`() {
        val plan = ServicePhotosLogic.planSave(emptyList(), listOf(fresh("n1"), fresh("n2")))
        assertEquals(listOf("n1", "n2"), keys(plan.uploads))
        assertFalse(plan.reorder)
    }

    // --- Ошибки ---

    @Test
    fun `maps photo step failures`() {
        assertEquals(CatalogError.NETWORK, ServicePhotosLogic.mapError(null))
        assertEquals(CatalogError.SERVICE_PHOTO_INVALID, ServicePhotosLogic.mapError(400))
        assertEquals(CatalogError.NOT_FOUND, ServicePhotosLogic.mapError(404))
        assertEquals(CatalogError.UNKNOWN, ServicePhotosLogic.mapError(500))
    }

    @Test
    fun `fromServer keeps the server order and ids`() {
        val drafts = ServicePhotosLogic.fromServer(listOf("a" to "x", "b" to "y"))
        assertEquals(listOf("a", "b"), keys(drafts))
        assertTrue(drafts.none { it.isNew })
    }
}
