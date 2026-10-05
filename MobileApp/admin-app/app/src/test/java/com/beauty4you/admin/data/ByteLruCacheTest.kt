package com.beauty4you.admin.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// item75-fix: кэш декодированных картинок ограничен по байтам, давно не использованные вытесняются
class ByteLruCacheTest {

    // Значение — его размер в байтах
    private fun cache(maxBytes: Long) = ByteLruCache<String, Long>(maxBytes, sizeOf = { it })

    @Test
    fun `values within the limit are all kept`() {
        val c = cache(100)
        c.put("a", 40)
        c.put("b", 60)
        assertEquals(listOf("a", "b"), c.keys())
        assertEquals(100, c.sizeBytes)
    }

    @Test
    fun `least recently used value is evicted first`() {
        val c = cache(100)
        c.put("a", 40)
        c.put("b", 40)
        c.get("a") // "a" использована позже "b"
        c.put("c", 40)

        assertNull(c["b"])
        assertEquals(listOf("a", "c"), c.keys())
        assertEquals(80, c.sizeBytes)
    }

    @Test
    fun `several old values are evicted to fit a big one`() {
        val c = cache(100)
        c.put("a", 30)
        c.put("b", 30)
        c.put("c", 30)
        c.put("big", 90)

        assertEquals(listOf("big"), c.keys())
        assertEquals(90, c.sizeBytes)
    }

    @Test
    fun `value larger than the whole cache is not stored`() {
        val c = cache(100)
        c.put("a", 50)
        c.put("huge", 150)

        assertNull(c["huge"])
        assertEquals(listOf("a"), c.keys())
    }

    @Test
    fun `replacing a key recounts its size`() {
        val c = cache(100)
        c.put("a", 70)
        c.put("a", 20)
        assertEquals(20, c.sizeBytes)
    }

    @Test
    fun `replaced image is removed by key prefix`() {
        val c = cache(1000)
        c.put("111:1080", 100)
        c.put("111:132", 10)
        c.put("222:1080", 100)

        c.removeIf { it.startsWith("111:") }

        assertEquals(listOf("222:1080"), c.keys())
        assertEquals(100, c.sizeBytes)
    }
}
