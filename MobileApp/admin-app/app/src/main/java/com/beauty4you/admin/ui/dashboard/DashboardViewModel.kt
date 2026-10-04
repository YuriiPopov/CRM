package com.beauty4you.admin.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.domain.CalendarLogic
import com.beauty4you.admin.domain.DashboardLogic
import com.beauty4you.admin.domain.DayMarkers
import com.beauty4you.admin.domain.Formatters
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.ui.common.BookingItem
import com.beauty4you.admin.ui.common.toItem
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime

data class DashboardUiState(
    val loading: Boolean = true,
    val error: Boolean = false,
    val greetingName: String = "",
    val today: LocalDate = LocalDate.now(),
    val todayItems: List<BookingItem> = emptyList(),
    val upcomingItems: List<BookingItem> = emptyList(),
    val week: List<DayMarkers> = emptyList(),
    // Легенда меток недели — мастера, у которых на этой неделе есть записи
    val weekMasters: List<Master> = emptyList(),
    val pendingCount: Int = 0,
    val earliestPendingDate: LocalDate? = null,
)

class DashboardViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch { container.events.dataChanged.collect { load(silent = true) } }
    }

    fun load(silent: Boolean = false, force: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _state.update { it.copy(loading = true, error = false) }
            try {
                val today = LocalDate.now()
                val now = LocalDateTime.now()
                val weekStart = CalendarLogic.weekStartOf(today)
                val (catalog, bookings, pending) = coroutineScope {
                    val catalog = async { container.catalogRepository.get(force) }
                    val bookings = async { container.bookingsRepository.list(from = weekStart) }
                    val pending = async { container.bookingsRepository.pendingOnlineCount() }
                    Triple(catalog.await(), bookings.await(), pending.await())
                }
                val week = DashboardLogic.weekMarkers(bookings, weekStart)
                val weekMasterIds = week.flatMap { it.masterIds }.toSet()
                _state.value = DashboardUiState(
                    loading = false,
                    greetingName = Formatters.greetingName(container.sessionRepository.email.first()),
                    today = today,
                    todayItems = DashboardLogic.todayBookings(bookings, today).map(catalog::toItem),
                    upcomingItems = DashboardLogic.upcomingBookings(bookings, now).map(catalog::toItem),
                    week = week,
                    weekMasters = catalog.masters.filter { it.id in weekMasterIds },
                    pendingCount = pending,
                    earliestPendingDate = DashboardLogic.earliestPendingDate(bookings, now),
                )
            } catch (e: Exception) {
                android.util.Log.e("Dashboard", "load failed", e)
                _state.update { it.copy(loading = false, error = it.todayItems.isEmpty() && it.upcomingItems.isEmpty()) }
            }
        }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { DashboardViewModel(container) }
        }
    }
}
