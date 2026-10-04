package com.beauty4you.admin.ui.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.domain.Client
import com.beauty4you.admin.domain.ClientLogic
import com.beauty4you.admin.domain.ClientStats
import com.beauty4you.admin.ui.common.BookingItem
import com.beauty4you.admin.ui.common.toItem
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDateTime

data class ClientDetailUiState(
    val loading: Boolean = true,
    val error: Boolean = false,
    val client: Client? = null,
    val stats: ClientStats = ClientStats(0, 0),
    val history: List<BookingItem> = emptyList(),
)

class ClientDetailViewModel(private val container: AppContainer, private val clientId: String) : ViewModel() {

    private val _state = MutableStateFlow(ClientDetailUiState())
    val state: StateFlow<ClientDetailUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch { container.events.dataChanged.collect { load(silent = true) } }
    }

    fun load(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _state.update { it.copy(loading = true, error = false) }
            try {
                val (client, bookings) = coroutineScope {
                    val client = async { container.catalogRepository.getClient(clientId) }
                    // GET /bookings?clientId= — фильтр добавлен в backend в рамках item73
                    val bookings = async { container.bookingsRepository.listForClient(clientId) }
                    client.await() to bookings.await()
                }
                val catalog = container.catalogRepository.get()
                _state.value = ClientDetailUiState(
                    loading = false,
                    client = client,
                    stats = ClientLogic.stats(bookings, LocalDateTime.now()),
                    history = ClientLogic.history(bookings).map(catalog::toItem),
                )
            } catch (e: Exception) {
                android.util.Log.e("ClientDetail", "load failed", e)
                _state.update { it.copy(loading = false, error = it.client == null) }
            }
        }
    }

    companion object {
        fun factory(container: AppContainer, clientId: String) = viewModelFactory {
            initializer { ClientDetailViewModel(container, clientId) }
        }
    }
}
