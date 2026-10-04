package com.beauty4you.admin.ui.clients

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.R
import com.beauty4you.admin.data.remote.toApiFailure
import com.beauty4you.admin.domain.Client
import com.beauty4you.admin.domain.ClientLogic
import com.beauty4you.admin.domain.NewClientValidation
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NewClientForm(
    val name: String = "",
    val phone: String = "",
    val consent: Boolean = false,
    val saving: Boolean = false,
    @StringRes val error: Int? = null,
)

data class ClientsUiState(
    val loading: Boolean = true,
    val error: Boolean = false,
    val clients: List<Client> = emptyList(),
    // Завершённые визиты по клиенту
    val visits: Map<String, Int> = emptyMap(),
    val query: String = "",
    val newClient: NewClientForm? = null,
) {
    val filtered: List<Client> get() = ClientLogic.search(clients, query)
}

class ClientsViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(ClientsUiState())
    val state: StateFlow<ClientsUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch { container.events.dataChanged.collect { load(silent = true) } }
    }

    fun load(silent: Boolean = false, force: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _state.update { it.copy(loading = true, error = false) }
            try {
                val (catalog, bookings) = coroutineScope {
                    val catalog = async { container.catalogRepository.get(force) }
                    val bookings = async { container.bookingsRepository.list() }
                    catalog.await() to bookings.await()
                }
                _state.update {
                    it.copy(
                        loading = false,
                        error = false,
                        clients = catalog.clients,
                        visits = ClientLogic.completedVisitsByClient(bookings),
                    )
                }
            } catch (e: Exception) {
                android.util.Log.e("Clients", "load failed", e)
                _state.update { it.copy(loading = false, error = it.clients.isEmpty()) }
            }
        }
    }

    fun onQueryChange(query: String) = _state.update { it.copy(query = query) }

    fun openNewClient() = _state.update { it.copy(newClient = NewClientForm()) }

    fun closeNewClient() = _state.update { it.copy(newClient = null) }

    fun updateNewClient(transform: (NewClientForm) -> NewClientForm) =
        _state.update { s -> s.copy(newClient = s.newClient?.let { transform(it).copy(error = null) }) }

    fun saveNewClient() {
        val form = _state.value.newClient ?: return
        val valid = when (val v = ClientLogic.validateNewClient(form.name, form.phone)) {
            NewClientValidation.NameMissing -> return setNewClientError(R.string.client_error_name)
            NewClientValidation.PhoneInvalid -> return setNewClientError(R.string.client_error_phone)
            is NewClientValidation.Valid -> v
        }
        _state.update { it.copy(newClient = form.copy(saving = true, error = null)) }
        viewModelScope.launch {
            try {
                container.catalogRepository.createClient(valid.name, valid.phone, form.consent)
                container.events.toast(R.string.toast_client_created)
                container.events.notifyDataChanged()
                _state.update { it.copy(newClient = null, query = "") }
                load(silent = true)
            } catch (e: Exception) {
                val failure = e.toApiFailure()
                setNewClientError(if (failure.httpCode == null) R.string.error_network else R.string.error_validation)
            }
        }
    }

    private fun setNewClientError(@StringRes error: Int) =
        _state.update { s -> s.copy(newClient = s.newClient?.copy(saving = false, error = error)) }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { ClientsViewModel(container) }
        }
    }
}
