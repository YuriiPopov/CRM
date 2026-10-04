package com.beauty4you.admin.ui.more

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.DashboardLogic
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class MoreUiState(
    val loading: Boolean = true,
    val error: Boolean = false,
    val email: String? = null,
    val catalog: Catalog? = null,
    val todayByMaster: Map<String, Int> = emptyMap(),
)

// Общая ViewModel вкладки «Więcej»: Mistrzowie и Usługi — только просмотр (этап 1)
class MoreViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(MoreUiState())
    val state: StateFlow<MoreUiState> = _state.asStateFlow()

    fun load(force: Boolean = false) {
        viewModelScope.launch {
            _state.update { it.copy(loading = it.catalog == null, error = false) }
            try {
                val today = LocalDate.now()
                val catalog = container.catalogRepository.get(force)
                val bookings = container.bookingsRepository.list(from = today)
                _state.value = MoreUiState(
                    loading = false,
                    email = container.sessionRepository.email.first(),
                    catalog = catalog,
                    todayByMaster = DashboardLogic.todayCountByMaster(bookings, today),
                )
            } catch (e: Exception) {
                android.util.Log.e("More", "load failed", e)
                _state.update { it.copy(loading = false, error = it.catalog == null) }
            }
        }
    }

    fun logout() {
        viewModelScope.launch { container.sessionRepository.logout() }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { MoreViewModel(container) }
        }
    }
}
