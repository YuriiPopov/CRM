package com.beauty4you.client.data

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class PhotoDiskCacheTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun cache(maxBytes: Long) = PhotoDiskCache(File(tmp.root, "photos"), maxBytes)

    @Test
    fun `returns what was stored and null for an unknown key`() {
        val c = cache(100)
        c.put("p1", byteArrayOf(1, 2, 3))

        assertArrayEquals(byteArrayOf(1, 2, 3), c.get("p1"))
        assertNull(c.get("p2"))
    }

    @Test
    fun `evicts the least recently used file when over the limit`() {
        val dir = File(tmp.root, "photos")
        val c = PhotoDiskCache(dir, 10)
        c.put("old", ByteArray(4))
        c.put("new", ByteArray(4))
        // давность задаём явно: файловая система может округлять время до секунды
        File(dir, "old").setLastModified(1_000)
        File(dir, "new").setLastModified(2_000)

        c.put("third", ByteArray(4))

        assertNull(c.get("old"))
        assertEquals(4, c.get("new")!!.size)
        assertEquals(4, c.get("third")!!.size)
    }

    @Test
    fun `reading a file protects it from eviction`() {
        val dir = File(tmp.root, "photos")
        val c = PhotoDiskCache(dir, 10)
        c.put("a", ByteArray(4))
        c.put("b", ByteArray(4))
        File(dir, "a").setLastModified(1_000)
        File(dir, "b").setLastModified(2_000)

        c.get("a") // a теперь свежее b
        c.put("c", ByteArray(4))

        assertNull(c.get("b"))
        assertEquals(4, c.get("a")!!.size)
    }

    @Test
    fun `a file bigger than the whole cache is not stored`() {
        val c = cache(3)
        c.put("big", ByteArray(4))

        assertNull(c.get("big"))
        assertEquals(0, c.sizeBytes())
    }

    @Test
    fun `clear removes everything`() {
        val c = cache(100)
        c.put("a", ByteArray(4))
        c.clear()

        assertNull(c.get("a"))
        assertEquals(0, c.sizeBytes())
    }
}
