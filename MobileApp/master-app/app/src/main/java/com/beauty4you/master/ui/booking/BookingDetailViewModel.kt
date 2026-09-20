package com.beauty4you.master.ui.booking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.master.AppContainer
import com.beauty4you.master.data.repo.Appointment
import com.beauty4you.master.data.repo.BookingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class BookingDetailUiState(
    val loading: Boolean = true,
    val appointment: Appointment? = null,
    val error: String? = null,
)

class BookingDetailViewModel(private val bookingsRepository: BookingsRepository) : ViewModel() {

    private val _state = MutableStateFlow(BookingDetailUiState())
    val state: StateFlow<BookingDetailUiState> = _state.asStateFlow()

    fun load(id: String) {
        viewModelScope.launch {
            _state.value = BookingDetailUiState(loading = true)
            try {
                val appointment = bookingsRepository.getAppointment(id)
                _state.value = BookingDetailUiState(loading = false, appointment = appointment)
            } catch (e: Exception) {
                _state.value = BookingDetailUiState(loading = false, error = "Nie udało się załadować wizyty")
            }
        }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { BookingDetailViewModel(container.bookingsRepository) }
        }
    }
}
