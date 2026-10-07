package com.beauty4you.client.data

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class ServicePhotosTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val idCalls = mutableListOf<String>()
    private val byteCalls = mutableListOf<String>()
    private val decodeCalls = mutableListOf<Pair<String, Int>>()
    private var idsResult: List<String> = listOf("p1", "p2")
    private var failBytes = false

    private fun photos(memoryBytes: Long = 1_000, dispatcher: kotlinx.coroutines.CoroutineDispatcher) = ServicePhotos<String>(
        fetchIds = { id -> idCalls += id; idsResult },
        fetchBytes = { id ->
            byteCalls += id
            if (failBytes) throw IOException("offline")
            "bytes-$id".toByteArray()
        },
        decode = { bytes, side -> String(bytes).also { decodeCalls += it to side } },
        diskCache = PhotoDiskCache(File(tmp.root, "photos"), 10_000),
        memoryBytes = memoryBytes,
        sizeOf = { it.length.toLong() },
        ioDispatcher = dispatcher,
        decodeDispatcher = dispatcher,
    )

    @Test
    fun `ids are cached while the photo count matches and refetched when it changes`() = runTest {
        val p = photos(dispatcher = StandardTestDispatcher(testScheduler))

        assertEquals(listOf("p1", "p2"), p.ids("s1", 2))
        assertEquals(listOf("p1", "p2"), p.ids("s1", 2))
        assertEquals(1, idCalls.size)

        idsResult = listOf("p1", "p2", "p3")
        assertEquals(listOf("p1", "p2", "p3"), p.ids("s1", 3))
        assertEquals(2, idCalls.size)
    }

    @Test
    fun `a decoded photo is served from memory the second time`() = runTest {
        val p = photos(dispatcher = StandardTestDispatcher(testScheduler))

        assertEquals("bytes-p1", p.bitmap("p1", 540))
        assertEquals("bytes-p1", p.bitmap("p1", 540))

        assertEquals(1, byteCalls.size)
        assertEquals(1, decodeCalls.size)
    }

    @Test
    fun `bytes come from disk after eviction from memory - no second network request`() = runTest {
        val p = photos(memoryBytes = 8, dispatcher = StandardTestDispatcher(testScheduler)) // «bytes-p1» (8) — в памяти помещается одно фото

        p.bitmap("p1", 540)
        p.bitmap("p2", 540) // вытесняет p1 из памяти
        assertEquals("bytes-p1", p.bitmap("p1", 540))

        assertEquals(listOf("p1", "p2"), byteCalls)
        assertEquals(3, decodeCalls.size)
    }

    @Test
    fun `the same photo at another size is decoded again from the same bytes`() = runTest {
        val p = photos(dispatcher = StandardTestDispatcher(testScheduler))

        p.bitmap("p1", 150)
        p.bitmap("p1", 1080)

        assertEquals(1, byteCalls.size)
        assertEquals(listOf("bytes-p1" to 150, "bytes-p1" to 1080), decodeCalls)
    }

    @Test
    fun `concurrent requests for one photo share a single download`() = runTest {
        val gate = CompletableDeferred<Unit>()
        val p = ServicePhotos<String>(
            fetchIds = { emptyList() },
            fetchBytes = { id -> byteCalls += id; gate.await(); "x".toByteArray() },
            decode = { bytes, _ -> String(bytes) },
            diskCache = PhotoDiskCache(File(tmp.root, "photos2"), 10_000),
            memoryBytes = 100,
            sizeOf = { 1 },
            ioDispatcher = StandardTestDispatcher(testScheduler),
            decodeDispatcher = StandardTestDispatcher(testScheduler),
        )

        val a = async { p.bitmap("p1", 100) }
        val b = async { p.bitmap("p1", 200) }
        testScheduler.advanceUntilIdle()
        gate.complete(Unit)

        assertEquals("x", a.await())
        assertEquals("x", b.await())
        assertEquals(1, byteCalls.size)
    }

    @Test
    fun `a failed download gives null, is not cached and succeeds on retry`() = runTest {
        val p = photos(dispatcher = StandardTestDispatcher(testScheduler))

        failBytes = true
        assertNull(p.bitmap("p1", 540))

        failBytes = false
        assertEquals("bytes-p1", p.bitmap("p1", 540))
        assertEquals(2, byteCalls.size)
    }

    @Test
    fun `an undecodable image gives null`() = runTest {
        val p = ServicePhotos<String>(
            fetchIds = { emptyList() },
            fetchBytes = { "garbage".toByteArray() },
            decode = { _, _ -> null },
            diskCache = PhotoDiskCache(File(tmp.root, "photos3"), 10_000),
            memoryBytes = 100,
            sizeOf = { 1 },
            ioDispatcher = StandardTestDispatcher(testScheduler),
            decodeDispatcher = StandardTestDispatcher(testScheduler),
        )

        assertNull(p.bitmap("p1", 100))
    }

    @Test
    fun `clear drops memory, ids and the disk cache`() = runTest {
        val p = photos(dispatcher = StandardTestDispatcher(testScheduler))
        p.ids("s1", 2)
        p.bitmap("p1", 540)

        p.clear()
        p.ids("s1", 2)
        p.bitmap("p1", 540)

        assertEquals(2, idCalls.size)
        assertEquals(2, byteCalls.size)
        assertTrue(decodeCalls.size == 2)
    }
}
