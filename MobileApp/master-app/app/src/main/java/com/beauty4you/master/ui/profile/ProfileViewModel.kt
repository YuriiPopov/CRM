package com.beauty4you.master.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.master.AppContainer
import com.beauty4you.master.data.model.BookingStatus
import com.beauty4you.master.data.repo.BookingsRepository
import com.beauty4you.master.data.repo.DaySchedule
import com.beauty4you.master.data.repo.ScheduleRepository
import com.beauty4you.master.data.repo.SessionRepository
import com.beauty4you.master.data.repo.StaffRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class ProfileUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val masterId: String? = null,
    val name: String = "",
    val photoBase64: String? = null,
    val specialtyLine: String = "",
    val email: String? = null,
    val totalVisits: Int = 0,
    // Рейтинг — статичный плейсхолдер: в бэкенде нет модели отзывов (то же осознанное сужение,
    // что и в паузированном плане клиентского приложения).
    val rating: String = "4.9",
    val week: List<DaySchedule> = emptyList(),
)

class ProfileViewModel(
    private val staffRepository: StaffRepository,
    private val bookingsRepository: BookingsRepository,
    private val scheduleRepository: ScheduleRepository,
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

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
                    ?: error("Konto nie jest powiązane z profilem mistrza")
                val email = sessionRepository.email.first()

                val profile = staffRepository.getMyProfile(masterId)
                val appointments = bookingsRepository.listMyAppointments()
                val totalVisits = appointments.count { it.status == BookingStatus.COMPLETED }
                val weekStart = ScheduleRepository.currentIsoWeekStart()
                val week = scheduleRepository.getWeek(masterId, weekStart)

                _state.value = ProfileUiState(
                    loading = false,
                    masterId = masterId,
                    name = profile.name,
                    photoBase64 = profile.photo,
                    specialtyLine = profile.specialtyLine,
                    email = email,
                    totalVisits = totalVisits,
                    week = week,
                )
            } catch (e: HttpException) {
                if (e.code() == 401) {
                    sessionRepository.logout()
                } else {
                    android.util.Log.e("Profile", "load() failed", e)
                    _state.value = _state.value.copy(loading = false, error = "Nie udało się załadować profilu")
                }
            } catch (e: Exception) {
                android.util.Log.e("Profile", "load() failed", e)
                _state.value = _state.value.copy(loading = false, error = "Nie udało się załadować profilu")
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            sessionRepository.logout()
            onLoggedOut()
        }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer {
                ProfileViewModel(
                    container.staffRepository,
                    container.bookingsRepository,
                    container.scheduleRepository,
                    container.sessionRepository,
                )
            }
        }
    }
}
