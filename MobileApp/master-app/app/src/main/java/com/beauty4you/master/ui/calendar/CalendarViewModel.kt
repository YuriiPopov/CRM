package com.beauty4you.master.ui.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.master.AppContainer
import com.beauty4you.master.data.model.BookingStatus
import com.beauty4you.master.data.repo.Appointment
import com.beauty4you.master.data.repo.BookingsRepository
import com.beauty4you.master.data.repo.DaySchedule
import com.beauty4you.master.data.repo.ScheduleRepository
import com.beauty4you.master.data.repo.SessionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.time.DayOfWeek
import java.time.LocalDate

enum class CalendarViewMode { LIST, TIMELINE }

// Цикл фильтра статусов, как в дизайне ("Status: Wszystkie" -> цикл по тапу).
private val STATUS_FILTER_CYCLE: List<BookingStatus?> =
    listOf(null) + BookingStatus.entries

data class CalendarUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val masterId: String? = null,
    val allAppointments: List<Appointment> = emptyList(),
    val weekStart: LocalDate = LocalDate.now().with(DayOfWeek.MONDAY),
    val selectedDate: LocalDate = LocalDate.now(),
    val viewMode: CalendarViewMode = CalendarViewMode.LIST,
    val statusFilter: BookingStatus? = null,
    // График на текущую неделю (реальные данные, GET /master-schedules) — используется, чтобы
    // заштриховать в Timeline недоступное по графику время (см. TimelineView).
    val weekSchedule: List<DaySchedule> = emptyList(),
) {
    val weekDates: List<LocalDate> get() = (0..6).map { weekStart.plusDays(it.toLong()) }

    val dayAppointments: List<Appointment>
        get() = allAppointments
            .filter { it.date == selectedDate }
            .filter { statusFilter == null || it.status == statusFilter }
            .sortedBy { it.start }

    val selectedDaySchedule: DaySchedule?
        get() = weekSchedule.find { it.date == selectedDate }
}

class CalendarViewModel(
    private val bookingsRepository: BookingsRepository,
    private val scheduleRepository: ScheduleRepository,
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CalendarUiState())
    val state: StateFlow<CalendarUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) {
                _state.value = _state.value.copy(loading = true, error = null)
            }
            try {
                val masterId = sessionRepository.masterId.first()
                val appointments = bookingsRepository.listMyAppointments()
                val weekSchedule = masterId?.let {
                    scheduleRepository.getWeek(it, _state.value.weekStart)
                } ?: emptyList()
                _state.value = _state.value.copy(
                    loading = false,
                    masterId = masterId,
                    allAppointments = appointments,
                    weekSchedule = weekSchedule,
                )
            } catch (e: HttpException) {
                if (e.code() == 401) {
                    sessionRepository.logout()
                } else {
                    android.util.Log.e("Calendar", "load() failed", e)
                    _state.value = _state.value.copy(loading = false, error = "Nie udało się załadować wizyt")
                }
            } catch (e: Exception) {
                android.util.Log.e("Calendar", "load() failed", e)
                _state.value = _state.value.copy(loading = false, error = "Nie udało się załadować wizyt")
            }
        }
    }

    fun selectDate(date: LocalDate) {
        _state.value = _state.value.copy(selectedDate = date)
    }

    fun setViewMode(mode: CalendarViewMode) {
        _state.value = _state.value.copy(viewMode = mode)
    }

    fun cycleStatusFilter() {
        val current = _state.value.statusFilter
        val currentIndex = STATUS_FILTER_CYCLE.indexOf(current)
        val next = STATUS_FILTER_CYCLE[(currentIndex + 1) % STATUS_FILTER_CYCLE.size]
        _state.value = _state.value.copy(statusFilter = next)
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer {
                CalendarViewModel(
                    container.bookingsRepository,
                    container.scheduleRepository,
                    container.sessionRepository,
                )
            }
        }
    }
}
