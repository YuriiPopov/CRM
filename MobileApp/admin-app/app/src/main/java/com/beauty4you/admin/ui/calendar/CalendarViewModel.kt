package com.beauty4you.admin.ui.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.CalendarRequest
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.domain.CalendarFilter
import com.beauty4you.admin.domain.CalendarLogic
import com.beauty4you.admin.domain.MasterBlock
import com.beauty4you.admin.domain.ScheduleDay
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

enum class CalendarView { LIST, MASTERS, TIMELINE }

data class CalendarUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val error: Boolean = false,
    val view: CalendarView = CalendarView.LIST,
    val today: LocalDate = LocalDate.now(),
    val weekStart: LocalDate = CalendarLogic.weekStartOf(LocalDate.now()),
    val selectedDate: LocalDate = LocalDate.now(),
    val filter: CalendarFilter = CalendarFilter(),
    val catalog: Catalog? = null,
    // Записи, блокировки и график загруженной недели
    val bookings: List<Booking> = emptyList(),
    val blocks: List<MasterBlock> = emptyList(),
    val schedule: Map<Pair<String, LocalDate>, ScheduleDay> = emptyMap(),
) {
    val weekDates: List<LocalDate> get() = CalendarLogic.weekDates(weekStart)
    val dayBookings: List<Booking> get() = CalendarLogic.filterBookings(bookings, filter, selectedDate)
}

class CalendarViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(CalendarUiState())
    val state: StateFlow<CalendarUiState> = _state.asStateFlow()
    private var loadJob: Job? = null

    init {
        viewModelScope.launch { container.events.dataChanged.collect { load(silent = true) } }
    }

    fun load(silent: Boolean = false, force: Boolean = false, pullToRefresh: Boolean = false) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            val weekStart = _state.value.weekStart
            _state.update {
                it.copy(
                    loading = !silent && !pullToRefresh,
                    refreshing = pullToRefresh,
                    error = false,
                )
            }
            try {
                val weekEnd = weekStart.plusDays(7)
                val weekDates = CalendarLogic.weekDates(weekStart)
                val catalog = container.catalogRepository.get(force)
                val (bookings, blocks, schedule) = coroutineScope {
                    val bookings = async { container.bookingsRepository.list(from = weekStart) }
                    val blocks = async { container.scheduleRepository.blocks(weekStart, weekEnd) }
                    val schedule = async {
                        container.scheduleRepository.scheduleFor(catalog.masters.filter { it.isActive }.map { it.id }, weekDates)
                    }
                    Triple(bookings.await(), blocks.await(), schedule.await())
                }
                _state.update {
                    it.copy(
                        loading = false,
                        refreshing = false,
                        today = LocalDate.now(),
                        catalog = catalog,
                        bookings = bookings.filter { b -> b.date.isBefore(weekEnd) },
                        blocks = blocks,
                        schedule = schedule,
                    )
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                android.util.Log.e("Calendar", "load failed", e)
                _state.update { it.copy(loading = false, refreshing = false, error = it.catalog == null) }
            }
        }
    }

    fun setView(view: CalendarView) = _state.update { it.copy(view = view) }

    fun selectDate(date: LocalDate) {
        val newWeek = CalendarLogic.weekStartOf(date)
        val weekChanged = newWeek != _state.value.weekStart
        _state.update { it.copy(selectedDate = date, weekStart = newWeek) }
        if (weekChanged) load()
    }

    // Листание недель: выбранный день сдвигается на ту же позицию в новой неделе
    fun shiftWeek(weeks: Long) = selectDate(_state.value.selectedDate.plusWeeks(weeks))

    fun goToday() = selectDate(LocalDate.now())

    fun setMasterFilter(masterId: String?) = _state.update { it.copy(filter = it.filter.copy(masterId = masterId)) }

    fun setStatusFilter(status: BookingStatus?) = _state.update { it.copy(filter = it.filter.copy(status = status)) }

    // Переход с Panel: «Czekają na potwierdzenie» -> Status: Oczekująca, день ближайшей такой записи
    fun apply(request: CalendarRequest) {
        _state.update { it.copy(filter = it.filter.copy(status = request.status), view = CalendarView.LIST) }
        request.date?.let { selectDate(it) }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { CalendarViewModel(container) }
        }
    }
}
