package com.beauty4you.admin.ui.more

import com.beauty4you.admin.AppEvents
import com.beauty4you.admin.data.repo.MasterBlocksSource
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.MasterBlock
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

// Гонки ответов и пересоздание Activity у шторки «Blokady» (item76-fix)
@OptIn(ExperimentalCoroutinesApi::class)
class BlocksViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val anna = Master("a", "Anna")
    private val beata = Master("b", "Beata")
    private val day = LocalDate.now().plusDays(3)
    private val annaBlock = MasterBlock("blk-a", "a", day.atTime(10, 0), day.atTime(12, 0), "Urlop")
    private val beataBlock = MasterBlock("blk-b", "b", day.atTime(14, 0), day.atTime(15, 0), "Szkolenie")

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private class FakeSource : MasterBlocksSource {
        private val responses = mutableMapOf<String, CompletableDeferred<List<MasterBlock>>>()
        val requested = mutableListOf<String>()
        val cancelled = mutableListOf<String>()
        val deleted = mutableListOf<String>()

        fun respond(masterId: String, blocks: List<MasterBlock>) {
            responses.getOrPut(masterId) { CompletableDeferred() }.complete(blocks)
        }

        override suspend fun blocksOf(masterId: String, from: LocalDate): List<MasterBlock> {
            requested += masterId
            try {
                return responses.getOrPut(masterId) { CompletableDeferred() }.await()
            } catch (e: CancellationException) {
                cancelled += masterId
                throw e
            }
        }

        override suspend fun createBlock(masterId: String, startTime: String, endTime: String, reason: String): MasterBlock =
            error("not needed")

        override suspend fun deleteBlock(id: String) {
            deleted += id
        }
    }

    @Test
    fun `response for master A arriving after master B is opened is dropped`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = BlocksViewModel(source, AppEvents())

        vm.start(anna)
        runCurrent()
        vm.start(beata)
        runCurrent()
        assertEquals(listOf("a"), source.cancelled)

        source.respond("a", listOf(annaBlock))
        runCurrent()
        assertEquals(beata, vm.state.value.master)
        assertTrue("B ещё ждёт свой ответ", vm.state.value.loading)
        assertTrue(vm.state.value.blocks.isEmpty())

        source.respond("b", listOf(beataBlock))
        runCurrent()
        assertFalse(vm.state.value.loading)
        assertEquals(listOf(beataBlock), vm.state.value.blocks)
    }

    @Test
    fun `closing the sheet cancels the load and drops its response`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = BlocksViewModel(source, AppEvents())

        vm.start(anna)
        runCurrent()
        vm.reset()
        runCurrent()
        assertEquals(listOf("a"), source.cancelled)

        source.respond("a", listOf(annaBlock))
        runCurrent()
        assertNull(vm.state.value.master)
        assertTrue(vm.state.value.blocks.isEmpty())
    }

    @Test
    fun `only a block from the open master's list can be deleted`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = BlocksViewModel(source, AppEvents())
        vm.start(beata)
        source.respond("b", listOf(beataBlock))
        runCurrent()

        vm.askDelete(annaBlock)
        assertNull(vm.state.value.confirmDelete)
        vm.confirmDelete()
        runCurrent()
        assertTrue(source.deleted.isEmpty())

        vm.askDelete(beataBlock)
        vm.confirmDelete()
        runCurrent()
        assertEquals(listOf("blk-b"), source.deleted)
        assertTrue(vm.state.value.blocks.isEmpty())
    }

    @Test
    fun `new block draft survives activity recreation`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = BlocksViewModel(source, AppEvents())
        vm.start(anna)
        source.respond("a", listOf(annaBlock))
        runCurrent()
        vm.openNew()
        vm.setComment("Dentysta")
        assertTrue(vm.state.value.editor!!.isDirty)

        // Пересоздание Activity: reset() не вызывается, start() — повторно
        vm.start(anna)
        runCurrent()
        val editor = vm.state.value.editor!!
        assertTrue("«Odrzucić zmiany?» по-прежнему спросит", editor.isDirty)
        assertEquals("Dentysta", editor.form.comment)
        assertEquals(listOf(annaBlock), vm.state.value.blocks)
        assertEquals("блокировки не перезапрашиваются", listOf("a"), source.requested)
    }
}
