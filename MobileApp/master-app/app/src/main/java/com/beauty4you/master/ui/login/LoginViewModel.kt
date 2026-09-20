package com.beauty4you.master.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.master.AppContainer
import com.beauty4you.master.data.repo.SessionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val error: String? = null,
)

class LoginViewModel(private val sessionRepository: SessionRepository) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onEmailChange(value: String) {
        _state.value = _state.value.copy(email = value, error = null)
    }

    fun onPasswordChange(value: String) {
        _state.value = _state.value.copy(password = value, error = null)
    }

    fun login(onSuccess: () -> Unit) {
        val current = _state.value
        if (current.email.isBlank() || current.password.isBlank()) {
            _state.value = current.copy(error = "Podaj email i hasło")
            return
        }
        _state.value = current.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                sessionRepository.login(current.email.trim(), current.password)
                _state.value = _state.value.copy(loading = false)
                onSuccess()
            } catch (e: HttpException) {
                val message = if (e.code() == 401) {
                    "Nieprawidłowy email lub hasło"
                } else {
                    "Błąd połączenia (${e.code()})"
                }
                _state.value = _state.value.copy(loading = false, error = message)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = "Brak połączenia z serwerem")
            }
        }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { LoginViewModel(container.sessionRepository) }
        }
    }
}
