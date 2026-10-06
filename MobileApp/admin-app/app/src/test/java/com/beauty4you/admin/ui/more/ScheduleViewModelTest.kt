package com.beauty4you.admin.ui.more

import com.beauty4you.admin.AppEvents
import com.beauty4you.admin.data.repo.MasterScheduleSource
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.BookingConflict
import com.beauty4you.admin.domain.DayStatus
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.ScheduleDay
import com.beauty4you.admin.domain.ScheduleMonthPlan
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
import java.time.LocalTime
import java.time.YearMonth

// Гонки ответов и пересоздание Activity у шторки «Grafik pracy» (item76-fix)
@OptIn(ExperimentalCoroutinesApi::class)
class ScheduleViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val anna = Master("a", "Anna")
    private val beata = Master("b", "Beata")

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    // Ответ на загрузку графика приходит, когда тест вызовет respond()
    private class FakeSource : MasterScheduleSource {
        private val responses = mutableMapOf<String, CompletableDeferred<List<ScheduleDay>>>()
        val requested = mutableListOf<String>()
        val cancelled = mutableListOf<String>()

        fun respond(masterId: String, days: List<ScheduleDay>) {
            responses.getOrPut(masterId) { CompletableDeferred() }.complete(days)
        }

        override suspend fun monthsFor(masterId: String, months: List<YearMonth>): List<ScheduleDay> {
            requested += masterId
            try {
                return responses.getOrPut(masterId) { CompletableDeferred() }.await()
            } catch (e: CancellationException) {
                cancelled += masterId
                throw e
            }
        }

        override suspend fun conflicts(masterId: String, plan: ScheduleMonthPlan): List<BookingConflict> = emptyList()

        override suspend fun save(masterId: String, plan: ScheduleMonthPlan): List<ScheduleDay> = emptyList()
    }

    private fun viewModel(source: FakeSource) = ScheduleViewModel(source, { error("catalog not needed") }, AppEvents())

    private fun workingWeek(masterId: String, week: List<LocalDate>) =
        week.map { ScheduleDay(masterId, it, isWorking = true, startTime = LocalTime.of(9, 0), endTime = LocalTime.of(17, 0)) }

    @Test
    fun `response for master A arriving after master B is opened is dropped`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = viewModel(source)

        vm.start(anna)
        runCurrent()
        vm.start(beata)
        runCurrent()
        // Загрузка A отменена при открытии B
        assertEquals(listOf("a"), source.cancelled)

        source.respond("a", workingWeek("a", vm.state.value.week))
        runCurrent()
        assertEquals(beata, vm.state.value.master)
        assertTrue("B ещё ждёт свой ответ", vm.state.value.loading)
        assertTrue(vm.state.value.loaded.isEmpty())

        source.respond("b", emptyList())
        runCurrent()
        val state = vm.state.value
        assertFalse(state.loading)
        assertFalse("B не помечен как изменённый", state.isDirty)
        assertTrue(state.changed.isEmpty())
        assertTrue(state.week.all { state.edited[it]?.status == DayStatus.UNSET })
    }

    @Test
    fun `closing the sheet cancels the load and drops its response`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = viewModel(source)

        vm.start(anna)
        runCurrent()
        vm.reset()
        runCurrent()
        assertEquals(listOf("a"), source.cancelled)

        source.respond("a", workingWeek("a", vm.state.value.week))
        runCurrent()
        assertNull(vm.state.value.master)
        assertTrue(vm.state.value.loaded.isEmpty())
    }

    @Test
    fun `draft survives activity recreation`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = viewModel(source)
        vm.start(anna)
        source.respond("a", workingWeek("a", vm.state.value.week))
        runCurrent()
        val monday = vm.state.value.week.first()
        vm.toggleDay(monday)
        vm.setBulkWorking(false)
        vm.applyToSelected()
        assertTrue(vm.state.value.isDirty)

        // Пересоздание Activity: шторка снова в композиции, reset() не вызывается, start() — повторно
        vm.start(anna)
        runCurrent()
        val state = vm.state.value
        assertTrue("«Odrzucić zmiany?» по-прежнему спросит", state.isDirty)
        assertEquals(DayStatus.OFF, state.edited[monday]?.status)
        assertEquals(setOf(monday), state.selected)
        assertEquals("график не перезапрашивается", listOf("a"), source.requested)
    }

    @Test
    fun `reopening after close starts from a clean state`() = runTest(dispatcher) {
        val source = FakeSource()
        val vm = viewModel(source)
        vm.start(anna)
        source.respond("a", workingWeek("a", vm.state.value.week))
        runCurrent()
        vm.toggleDay(vm.state.value.week.first())
        vm.setBulkWorking(false)
        vm.applyToSelected()

        vm.reset()
        vm.start(anna)
        runCurrent()
        assertFalse(vm.state.value.isDirty)
        assertTrue(vm.state.value.selected.isEmpty())
    }
}
