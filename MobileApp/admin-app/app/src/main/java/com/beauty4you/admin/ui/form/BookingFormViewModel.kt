package com.beauty4you.admin.ui.form

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.R
import com.beauty4you.admin.data.remote.toApiFailure
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.BookingError
import com.beauty4you.admin.domain.BookingFormLogic
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.domain.BookingStatusRules
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.Service
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime

// Что открыть: существующую запись (original) или новую на дату / для клиента
data class FormRequest(
    val original: Booking? = null,
    val date: LocalDate? = null,
    val clientId: String? = null,
)

enum class FormMode { NEW, EDIT, READ_ONLY }

sealed interface SlotsState {
    data object NeedSelection : SlotsState
    data object Loading : SlotsState
    data class Loaded(val isWorkingDay: Boolean, val times: List<LocalTime>) : SlotsState
    data object Error : SlotsState
}

data class BookingFormState(
    val loading: Boolean = true,
    val catalog: Catalog? = null,
    val original: Booking? = null,
    val clientId: String? = null,
    val masterId: String? = null,
    val serviceId: String? = null,
    val date: LocalDate = LocalDate.now(),
    val time: LocalTime? = null,
    val status: BookingStatus = BookingStatus.CONFIRMED,
    val slots: SlotsState = SlotsState.NeedSelection,
    val saving: Boolean = false,
    val error: BookingError? = null,
    val confirmCancel: Boolean = false,
    val closed: Boolean = false,
) {
    val mode: FormMode
        get() = when {
            original == null -> FormMode.NEW
            BookingStatusRules.canReschedule(original.status) -> FormMode.EDIT
            else -> FormMode.READ_ONLY
        }

    // В режиме переноса услуга и клиент фиксированы (PATCH /reschedule их не меняет), поэтому
    // мастера — только оказывающие эту услугу, плюс текущий мастер записи (даже если неактивен)
    val masterOptions: List<Master>
        get() {
            val masters = catalog?.masters.orEmpty()
            val options = BookingFormLogic.mastersForService(masters, serviceId)
            val current = original?.let { o -> masters.find { it.id == o.masterId } }
            return if (current != null && current !in options) listOf(current) + options else options
        }

    val serviceOptions: List<Service>
        get() = BookingFormLogic.servicesForMaster(catalog?.services.orEmpty(), catalog?.masters.orEmpty(), masterId)

    val statusOptions: List<BookingStatus> get() = BookingStatusRules.formStatusOptions(original?.status)

    val timeOptions: List<LocalTime>
        get() {
            val free = (slots as? SlotsState.Loaded)?.times.orEmpty()
            return BookingFormLogic.timeOptions(free, BookingFormLogic.keepTimeFor(original, masterId, date))
        }

    val canSave: Boolean
        get() = !saving && mode != FormMode.READ_ONLY &&
            clientId != null && masterId != null && serviceId != null && time != null

    val canCancel: Boolean get() = original != null && BookingStatusRules.canCancel(original.status) && !saving
}

class BookingFormViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(BookingFormState())
    val state: StateFlow<BookingFormState> = _state.asStateFlow()
    private var slotsJob: Job? = null

    fun start(request: FormRequest) {
        slotsJob?.cancel()
        val original = request.original
        _state.value = BookingFormState(
            original = original,
            clientId = original?.clientId ?: request.clientId,
            masterId = original?.masterId,
            serviceId = original?.serviceId,
            date = original?.date ?: request.date ?: LocalDate.now(),
            time = original?.start?.toLocalTime(),
            status = BookingFormLogic.initialStatus(original),
        )
        viewModelScope.launch {
            try {
                val catalog = container.catalogRepository.get()
                _state.update { it.copy(loading = false, catalog = catalog) }
                refreshSlots()
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = BookingFormLogic.mapError(null, null)) }
            }
        }
    }

    fun selectClient(id: String) = _state.update { it.copy(clientId = id, error = null) }

    fun selectMaster(id: String) {
        val masters = _state.value.catalog?.masters.orEmpty()
        _state.update {
            val serviceId = if (it.mode == FormMode.EDIT) it.serviceId else BookingFormLogic.serviceAfterMasterChange(masters, id, it.serviceId)
            it.copy(masterId = id, serviceId = serviceId, time = keepOrNull(it, id, it.date), error = null)
        }
        refreshSlots()
    }

    fun selectService(id: String) {
        val masters = _state.value.catalog?.masters.orEmpty()
        _state.update {
            it.copy(serviceId = id, masterId = BookingFormLogic.masterAfterServiceChange(masters, id, it.masterId), time = null, error = null)
        }
        refreshSlots()
    }

    fun selectDate(date: LocalDate) {
        _state.update { it.copy(date = date, time = keepOrNull(it, it.masterId, date), error = null) }
        refreshSlots()
    }

    fun selectTime(time: LocalTime) = _state.update { it.copy(time = time, error = null) }

    fun selectStatus(status: BookingStatus) = _state.update { it.copy(status = status, error = null) }

    fun askCancel() = _state.update { it.copy(confirmCancel = true) }

    fun dismissCancel() = _state.update { it.copy(confirmCancel = false) }

    // При переносе исходное время остаётся выбранным, пока не сменили мастера/дату
    private fun keepOrNull(state: BookingFormState, masterId: String?, date: LocalDate): LocalTime? =
        BookingFormLogic.keepTimeFor(state.original, masterId, date)

    private fun refreshSlots() {
        slotsJob?.cancel()
        val s = _state.value
        val masterId = s.masterId
        val serviceId = s.serviceId
        if (masterId == null || serviceId == null || s.mode == FormMode.READ_ONLY) {
            _state.update { it.copy(slots = SlotsState.NeedSelection) }
            return
        }
        _state.update { it.copy(slots = SlotsState.Loading) }
        slotsJob = viewModelScope.launch {
            val result = try {
                val slots = container.bookingsRepository.freeSlots(masterId, serviceId, s.date)
                SlotsState.Loaded(slots.isWorkingDay, slots.times)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                SlotsState.Error
            }
            _state.update { it.copy(slots = result) }
        }
    }

    fun save() {
        val s = _state.value
        if (!s.canSave) return
        val masterId = s.masterId!!
        val time = s.time!!
        val plan = BookingFormLogic.planSave(s.original, masterId, s.date, time, s.status)
        if (plan.isNoop) {
            _state.update { it.copy(closed = true) }
            return
        }
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            try {
                val startTime = BookingFormLogic.toApiDateTime(s.date, time)
                var booking = s.original
                if (plan.create) {
                    booking = container.bookingsRepository.create(s.clientId!!, masterId, s.serviceId!!, startTime)
                    // Запись уже создана: повторное «Zapisz» после ошибки смены статуса не должно
                    // создать дубликат — дальше форма работает с ней как с существующей
                    _state.update { it.copy(original = booking) }
                }
                if (plan.reschedule) {
                    booking = container.bookingsRepository.reschedule(booking!!.id, startTime, masterId)
                }
                plan.statusChange?.let { booking = container.bookingsRepository.setStatus(booking!!.id, it) }
                finish(if (plan.create) R.string.toast_booking_created else R.string.toast_booking_updated)
            } catch (e: Exception) {
                val failure = e.toApiFailure()
                val error = BookingFormLogic.mapError(failure.httpCode, failure.message)
                _state.update { it.copy(saving = false, error = error) }
                // Время заняли/заблокировали, пока форма была открыта — список свободных слотов устарел
                if (BookingFormLogic.staleSlots(error)) refreshSlots()
                container.events.notifyDataChanged()
            }
        }
    }

    // «Usuń» = отмена записи (CANCELLED), физического удаления в этапе 1 нет
    fun confirmCancel() {
        val original = _state.value.original ?: return
        _state.update { it.copy(confirmCancel = false, saving = true, error = null) }
        viewModelScope.launch {
            try {
                container.bookingsRepository.setStatus(original.id, BookingStatus.CANCELLED)
                finish(R.string.toast_booking_cancelled)
            } catch (e: Exception) {
                val failure = e.toApiFailure()
                _state.update { it.copy(saving = false, error = BookingFormLogic.mapError(failure.httpCode, failure.message)) }
            }
        }
    }

    private fun finish(toast: Int) {
        container.events.notifyDataChanged()
        container.events.toast(toast)
        _state.update { it.copy(saving = false, closed = true) }
    }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { BookingFormViewModel(container) }
        }
    }
}
