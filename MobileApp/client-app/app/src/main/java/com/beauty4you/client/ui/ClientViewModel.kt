package com.beauty4you.client.ui

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.client.B4UClientApp
import com.beauty4you.client.R
import com.beauty4you.client.data.AuthRepository
import com.beauty4you.client.data.LoyaltyStore
import com.beauty4you.client.data.MockData
import com.beauty4you.client.data.PaymentMethod
import com.beauty4you.client.data.SalonRepository
import com.beauty4you.client.data.Slot
import com.beauty4you.client.data.remote.ApiException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

enum class Tab { NEWS, HOME, SERVICES, BOOKINGS, PROFILE }

// Экран = активная вкладка + опциональный "pushed" экран поверх неё (Mistrz, Program
// lojalnościowy) — как в прототипе, где эти экраны не являются вкладками.
sealed interface Pushed {
    data class MasterDetail(val masterId: String) : Pushed
    data object Loyalty : Pushed
}

data class BookingDraft(
    val serviceId: String,
    val masterId: String,
    val date: LocalDate,
    val payment: PaymentMethod,
    val slots: List<Slot> = emptyList(),
    val slotsLoading: Boolean = true,
    val selectedSlot: Slot? = null,
    val submitting: Boolean = false,
)

data class Toast(@StringRes val message: Int, val id: Long = System.nanoTime())

data class NavState(
    val tab: Tab = Tab.NEWS,
    val pushed: Pushed? = null,
    val bookingsShowUpcoming: Boolean = true,
    val servicesCategoryId: String? = null,
)

sealed interface LoadState {
    data object Loading : LoadState
    data object Ready : LoadState
    data class Failed(@StringRes val message: Int) : LoadState
}

// Сколько дней вперёд искать первый день со свободными слотами при открытии шторки записи
private const val SLOT_SEARCH_DAYS = 14L

class ClientViewModel(
    val repo: SalonRepository,
    val loyalty: LoyaltyStore,
    private val auth: AuthRepository,
) : ViewModel() {

    private val _load = MutableStateFlow<LoadState>(LoadState.Loading)
    val load: StateFlow<LoadState> = _load.asStateFlow()

    private val _nav = MutableStateFlow(NavState())
    val nav: StateFlow<NavState> = _nav.asStateFlow()

    private val _draft = MutableStateFlow<BookingDraft?>(null)
    val draft: StateFlow<BookingDraft?> = _draft.asStateFlow()

    private val _toast = MutableStateFlow<Toast?>(null)
    val toast: StateFlow<Toast?> = _toast.asStateFlow()

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    val client = repo.client
    val catalog = repo.catalog
    val bookings = repo.bookings
    val points = loyalty.points
    val news = MockData.news()
    val contacts = MockData.contacts

    private var slotsJob: Job? = null

    /** Вызывается при входе в основную часть; после выхода и повторного входа грузит данные заново. */
    fun start() {
        if (repo.client.value == null) {
            // Новая сессия (в т.ч. другой клиент после 401) — навигация с чистого листа
            _nav.value = NavState()
            _draft.value = null
            reload()
        } else if (_load.value is LoadState.Failed) {
            reload()
        }
    }

    fun reload() {
        viewModelScope.launch {
            _load.value = LoadState.Loading
            _load.value = try {
                repo.refreshAll()
                LoadState.Ready
            } catch (e: ApiException) {
                LoadState.Failed(errorMessage(e))
            }
        }
    }

    fun refreshBookings() {
        viewModelScope.launch {
            _refreshing.value = true
            try {
                repo.refreshBookings()
            } catch (e: ApiException) {
                showToast(errorMessage(e))
            } finally {
                _refreshing.value = false
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            auth.logout()
            _load.value = LoadState.Loading
        }
    }

    // --- Навигация ---

    fun selectTab(tab: Tab) {
        _nav.update { it.copy(tab = tab, pushed = null) }
        // Записи могли измениться в салоне (подтверждение, отмена администратором)
        if (tab == Tab.BOOKINGS) refreshBookings()
    }

    fun openMaster(id: String) = _nav.update { it.copy(pushed = Pushed.MasterDetail(id)) }
    fun openLoyalty() = _nav.update { it.copy(pushed = Pushed.Loyalty) }
    fun back() = _nav.update { it.copy(pushed = null) }
    fun setBookingsUpcoming(upcoming: Boolean) = _nav.update { it.copy(bookingsShowUpcoming = upcoming) }
    fun setServicesCategory(categoryId: String?) = _nav.update { it.copy(servicesCategoryId = categoryId) }

    fun showToast(@StringRes message: Int) {
        _toast.value = Toast(message)
    }

    fun clearToast(toast: Toast) = _toast.update { if (it?.id == toast.id) null else it }

    // --- Запись ---

    /**
     * Открывает шторку записи, предзаполненную услугой/мастером. Мастер подбирается среди тех,
     * кто оказывает выбранную услугу; дата — первый день с свободными слотами.
     */
    fun startBooking(serviceId: String? = null, masterId: String? = null) {
        val catalog = catalog.value ?: return
        val service = serviceId?.let(catalog::service)
            ?: masterId?.let(catalog::master)?.serviceIds?.firstNotNullOfOrNull(catalog::service)
            ?: catalog.services.firstOrNull()
            ?: return
        val candidates = catalog.mastersFor(service.id)
        val master = candidates.firstOrNull { it.id == masterId } ?: candidates.firstOrNull() ?: return

        _draft.value = BookingDraft(
            serviceId = service.id,
            masterId = master.id,
            date = LocalDate.now(),
            payment = PaymentMethod.IN_SALON,
        )
        loadSlots(searchForward = true)
    }

    fun closeBooking() {
        slotsJob?.cancel()
        _draft.value = null
    }

    fun selectDraftService(serviceId: String) {
        val catalog = catalog.value ?: return
        _draft.update { d ->
            d ?: return
            val candidates = catalog.mastersFor(serviceId)
            val masterId = if (candidates.any { it.id == d.masterId }) d.masterId else candidates.first().id
            d.copy(serviceId = serviceId, masterId = masterId)
        }
        loadSlots(searchForward = false)
    }

    fun selectDraftMaster(masterId: String) {
        _draft.update { it?.copy(masterId = masterId) }
        loadSlots(searchForward = false)
    }

    fun selectDraftDate(date: LocalDate) {
        _draft.update { it?.copy(date = date) }
        loadSlots(searchForward = false)
    }

    fun selectDraftSlot(slot: Slot) = _draft.update { it?.copy(selectedSlot = slot) }
    fun selectDraftPayment(payment: PaymentMethod) = _draft.update { it?.copy(payment = payment) }

    private fun loadSlots(searchForward: Boolean) {
        slotsJob?.cancel()
        val initial = _draft.value ?: return
        _draft.update { it?.copy(slotsLoading = true, slots = emptyList(), selectedSlot = null) }
        slotsJob = viewModelScope.launch {
            try {
                var date = initial.date
                var slots = repo.slots(initial.masterId, initial.serviceId, date)
                if (searchForward) {
                    val last = initial.date.plusDays(SLOT_SEARCH_DAYS)
                    while (slots.isEmpty() && date.isBefore(last)) {
                        date = date.plusDays(1)
                        slots = repo.slots(initial.masterId, initial.serviceId, date)
                    }
                    if (slots.isEmpty()) date = initial.date
                }
                _draft.update {
                    it?.copy(date = date, slots = slots, selectedSlot = slots.firstOrNull(), slotsLoading = false)
                }
            } catch (e: ApiException) {
                _draft.update { it?.copy(slotsLoading = false) }
                showToast(errorMessage(e))
            }
        }
    }

    fun confirmBooking() {
        val d = _draft.value ?: return
        val slot = d.selectedSlot ?: return
        val service = catalog.value?.service(d.serviceId) ?: return
        _draft.update { it?.copy(submitting = true) }
        viewModelScope.launch {
            try {
                repo.createBooking(d.masterId, d.serviceId, slot)
                loyalty.onBookingCreated(service.price, d.payment)
                _draft.value = null
                _nav.update { it.copy(tab = Tab.BOOKINGS, pushed = null, bookingsShowUpcoming = true) }
                showToast(R.string.toast_booked)
            } catch (e: ApiException) {
                _draft.update { it?.copy(submitting = false) }
                if (e.kind == ApiException.Kind.CONFLICT) {
                    // Слот успели занять (или он вне графика) — обновляем список, оставляя шторку открытой
                    showToast(R.string.error_slot_taken)
                    loadSlots(searchForward = false)
                } else {
                    showToast(errorMessage(e))
                }
            }
        }
    }

    fun cancelBooking(id: String) {
        viewModelScope.launch {
            try {
                repo.cancelBooking(id)
                showToast(R.string.toast_cancelled)
            } catch (e: ApiException) {
                showToast(if (e.kind == ApiException.Kind.CONFLICT) R.string.error_cannot_cancel else errorMessage(e))
                refreshBookings()
            }
        }
    }

    fun repeatBooking(id: String) {
        val booking = bookings.value.firstOrNull { it.id == id } ?: return
        if (catalog.value?.service(booking.serviceId) == null) {
            showToast(R.string.error_service_unavailable)
            return
        }
        startBooking(booking.serviceId, booking.masterId)
    }

    // --- Лояльность (мок, см. LoyaltyStore) ---

    fun redeemReward(rewardId: String) {
        showToast(if (loyalty.redeem(rewardId)) R.string.toast_reward_ok else R.string.toast_reward_low)
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val container = (this[androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY] as B4UClientApp).container
                ClientViewModel(container.salonRepository, container.loyaltyStore, container.authRepository)
            }
        }
    }
}

@StringRes
fun errorMessage(e: ApiException): Int = when (e.kind) {
    ApiException.Kind.NETWORK -> R.string.error_network
    ApiException.Kind.TOO_MANY_REQUESTS -> R.string.error_too_many
    else -> R.string.error_generic
}
