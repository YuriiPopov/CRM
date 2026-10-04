package com.beauty4you.admin.ui.login

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.R
import com.beauty4you.admin.data.repo.NotAdminException
import com.beauty4you.admin.data.repo.SessionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class LoginError(@StringRes val message: Int, val code: Int? = null)

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val error: LoginError? = null,
)

class LoginViewModel(private val sessionRepository: SessionRepository) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onEmailChange(value: String) = _state.update { it.copy(email = value, error = null) }

    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, error = null) }

    fun login() {
        val current = _state.value
        if (current.email.isBlank() || current.password.isBlank()) {
            _state.update { it.copy(error = LoginError(R.string.login_error_empty)) }
            return
        }
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            val error = try {
                sessionRepository.login(current.email.trim(), current.password)
                null
            } catch (e: NotAdminException) {
                LoginError(R.string.login_error_not_admin)
            } catch (e: HttpException) {
                // 400 — валидация формы логина (короткий пароль и т.п.), по сути тоже неверные данные
                if (e.code() == 401 || e.code() == 400) {
                    LoginError(R.string.login_error_credentials)
                } else {
                    LoginError(R.string.login_error_http, e.code())
                }
            } catch (e: Exception) {
                LoginError(R.string.error_network)
            }
            // При успехе корень приложения сам переключится на главный экран по появившемуся токену
            _state.update { it.copy(loading = false, error = error) }
        }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { LoginViewModel(container.sessionRepository) }
        }
    }
}
