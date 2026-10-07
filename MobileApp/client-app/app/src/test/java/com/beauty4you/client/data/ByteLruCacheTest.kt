package com.beauty4you.client.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ByteLruCacheTest {

    private fun cache(maxBytes: Long) = ByteLruCache<String, String>(maxBytes) { it.length.toLong() }

    @Test
    fun `evicts the least recently used entry when over the byte limit`() {
        val c = cache(10)
        c.put("a", "1234")
        c.put("b", "1234")
        c["a"] // a свежее b
        c.put("c", "1234")

        assertNull(c["b"])
        assertEquals("1234", c["a"])
        assertEquals("1234", c["c"])
        assertEquals(8, c.sizeBytes)
    }

    @Test
    fun `a value bigger than the whole cache is not stored and keeps the rest`() {
        val c = cache(5)
        c.put("a", "123")
        c.put("big", "123456")

        assertNull(c["big"])
        assertEquals("123", c["a"])
    }

    @Test
    fun `replacing a key updates the size`() {
        val c = cache(10)
        c.put("a", "1234")
        c.put("a", "12")

        assertEquals(2, c.sizeBytes)
    }

    @Test
    fun `removeIf drops matching keys`() {
        val c = cache(100)
        c.put("x:1", "aa")
        c.put("y:1", "bb")
        c.removeIf { it.startsWith("x") }

        assertNull(c["x:1"])
        assertEquals("bb", c["y:1"])
        assertEquals(2, c.sizeBytes)
    }
}
