package com.beauty4you.master.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.master.AppContainer
import com.beauty4you.master.data.model.BookingStatus
import com.beauty4you.master.data.repo.Appointment
import com.beauty4you.master.data.repo.BookingsRepository
import com.beauty4you.master.data.repo.StaffRepository
import com.beauty4you.master.data.repo.SessionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.time.LocalDate

data class DashboardUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val masterId: String? = null,
    val masterName: String = "",
    val photoBase64: String? = null,
    val today: LocalDate = LocalDate.now(),
    val todayCount: Int = 0,
    val weekCount: Int = 0,
    val completedCount: Int = 0,
    val todaysAppointments: List<Appointment> = emptyList(),
    val weekDates: List<LocalDate> = emptyList(),
    // Даты недели, на которые реально есть хотя бы одна запись — акцентная полоска под днём
    // в разделе "Tydzień" рисуется только для них, а не под каждым днём подряд.
    val weekDatesWithAppointments: Set<LocalDate> = emptySet(),
)

class DashboardViewModel(
    private val bookingsRepository: BookingsRepository,
    private val staffRepository: StaffRepository,
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = _state.asStateFlow()

    init {
        load()
    }

    // silent=true — используется при возврате на вкладку (см. RefreshOnResume в DashboardScreen):
    // Compose-навигация с save/restoreState держит этот ViewModel живым между переключениями
    // табов, поэтому без повторной загрузки новые записи, созданные в другом месте (веб-CRM),
    // не появлялись бы, пока приложение не перезапустят. silent — чтобы не мигать спиннером
    // при каждом переключении таба, если данные уже есть.
    fun load(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) {
                _state.value = _state.value.copy(loading = true, error = null)
            }
            try {
                val masterId = sessionRepository.masterId.first()
                    ?: error("Konto nie jest powiązane z profilem mistrza")

                val profile = staffRepository.getMyProfile(masterId)
                val appointments = bookingsRepository.listMyAppointments()

                val today = LocalDate.now()
                val weekStart = today.with(java.time.DayOfWeek.MONDAY)
                val weekDates = (0..6).map { weekStart.plusDays(it.toLong()) }
                val weekEnd = weekStart.plusDays(6)

                val todays = appointments.filter { it.date == today }
                val thisWeek = appointments.filter { it.date in weekStart..weekEnd }
                val completed = appointments.count { it.status == BookingStatus.COMPLETED }

                _state.value = DashboardUiState(
                    loading = false,
                    masterId = masterId,
                    masterName = profile.name,
                    photoBase64 = profile.photo,
                    today = today,
                    todayCount = todays.size,
                    weekCount = thisWeek.size,
                    completedCount = completed,
                    todaysAppointments = todays.sortedBy { it.start },
                    weekDates = weekDates,
                    weekDatesWithAppointments = thisWeek.map { it.date }.toSet(),
                )
            } catch (e: HttpException) {
                if (e.code() == 401) {
                    sessionRepository.logout()
                } else {
                    android.util.Log.e("Dashboard", "load() failed", e)
                    _state.value = _state.value.copy(loading = false, error = "Nie udało się załadować danych")
                }
            } catch (e: Exception) {
                android.util.Log.e("Dashboard", "load() failed", e)
                _state.value = _state.value.copy(loading = false, error = "Nie udało się załadować danych")
            }
        }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer {
                DashboardViewModel(
                    container.bookingsRepository,
                    container.staffRepository,
                    container.sessionRepository,
                )
            }
        }
    }
}
