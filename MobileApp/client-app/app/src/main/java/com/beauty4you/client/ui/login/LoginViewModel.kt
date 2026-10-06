package com.beauty4you.client.ui.login

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.client.B4UClientApp
import com.beauty4you.client.R
import com.beauty4you.client.data.AuthRepository
import com.beauty4you.client.data.VerifyOutcome
import com.beauty4you.client.data.remote.ApiException
import com.beauty4you.client.domain.PhoneInput
import com.beauty4you.client.ui.errorMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class LoginStep { PHONE, CODE, PROFILE }

data class LoginState(
    val step: LoginStep = LoginStep.PHONE,
    /** Только национальные цифры (до 9); «+48» — фиксированный префикс в UI. */
    val phone: String = "",
    /** Нормализованный сервером телефон, на который реально ушёл код. */
    val sentTo: String = "",
    val code: String = "",
    val devCode: String? = null,
    val name: String = "",
    val consent: Boolean = false,
    val loading: Boolean = false,
    @StringRes val error: Int? = null,
)

/** Вход по телефону: номер → SMS-код → (только для нового клиента) имя и согласие RODO. */
class LoginViewModel(private val auth: AuthRepository) : ViewModel() {

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state.asStateFlow()

    fun onPhoneChange(value: String) = _state.update { it.copy(phone = PhoneInput.normalize(value), error = null) }
    fun onCodeChange(value: String) = _state.update { it.copy(code = value.filter(Char::isDigit).take(6), error = null) }
    fun onNameChange(value: String) = _state.update { it.copy(name = value, error = null) }
    fun onConsentChange(value: Boolean) = _state.update { it.copy(consent = value, error = null) }

    fun back() = _state.update {
        it.copy(step = LoginStep.PHONE, code = "", devCode = null, error = null)
    }

    fun requestCode() = run {
        val result = auth.requestCode(PhoneInput.toE164(_state.value.phone))
        _state.update {
            it.copy(step = LoginStep.CODE, sentTo = result.phone, devCode = result.devCode, code = "")
        }
    }

    fun verify() = run {
        val s = _state.value
        when (auth.verify(s.sentTo, s.code)) {
            VerifyOutcome.LoggedIn -> Unit // корневой экран переключится сам (SessionStore)
            VerifyOutcome.ProfileRequired -> _state.update { it.copy(step = LoginStep.PROFILE) }
        }
    }

    fun completeProfile() = run {
        val s = _state.value
        auth.verify(s.sentTo, s.code, name = s.name.trim(), consentGiven = s.consent)
    }

    private fun run(block: suspend () -> Unit) {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                block()
            } catch (e: ApiException) {
                _state.update { it.copy(error = loginError(e)) }
            } finally {
                _state.update { it.copy(loading = false) }
            }
        }
    }

    @StringRes
    private fun loginError(e: ApiException): Int = when {
        e.kind == ApiException.Kind.UNAUTHORIZED -> R.string.login_error_code
        // 400 на request-code — сервер не принял формат номера
        e.kind == ApiException.Kind.OTHER && _state.value.step == LoginStep.PHONE -> R.string.login_error_phone
        else -> errorMessage(e)
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                LoginViewModel((this[APPLICATION_KEY] as B4UClientApp).container.authRepository)
            }
        }
    }
}
