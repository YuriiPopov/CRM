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
import com.beauty4you.client.data.NewsState
import com.beauty4you.client.data.DaySlots
import com.beauty4you.client.data.SalonRepository
import com.beauty4you.client.data.ServicePhotos
import androidx.compose.ui.graphics.ImageBitmap
import com.beauty4you.client.data.Slot
import com.beauty4you.client.data.remote.ApiException
import com.beauty4you.client.ui.booking.canConfirm
import com.beauty4you.client.ui.booking.canGoToPreviousWeek
import com.beauty4you.client.ui.booking.newBookingDraft
import com.beauty4you.client.ui.booking.pickDate
import com.beauty4you.client.ui.booking.weekDays
import com.beauty4you.client.ui.booking.withDate
import com.beauty4you.client.ui.booking.withMaster
import com.beauty4you.client.ui.booking.withService
import com.beauty4you.client.ui.booking.withWeek
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
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
    data class ServiceDetail(val serviceId: String) : Pushed
    data object Loyalty : Pushed
}

data class BookingDraft(
    val serviceId: String?,
    val masterId: String?,
    /** Вход из карточки мастера: список услуг сужен до его услуг. */
    val narrowToMasterId: String? = null,
    /** Понедельник показываемой недели календаря. */
    val weekStart: LocalDate,
    val date: LocalDate? = null,
    /** Слоты мастера на неделю; null — не запрашивались (не выбраны услуга или мастер). */
    val week: WeekSlots? = null,
    val selectedSlot: Slot? = null,
    val submitting: Boolean = false,
)

sealed interface WeekSlots {
    data object Loading : WeekSlots
    data class Ready(val days: Map<LocalDate, DaySlots>) : WeekSlots
    data class Failed(@StringRes val message: Int) : WeekSlots
}

/** Полноэкранный просмотр фото услуги (item84): id фото по порядку и открытая страница. */
data class PhotoViewer(val photoIds: List<String>, val page: Int)

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

// На сколько недель вперёд листать при открытии записи, если в текущей неделе нет свободных слотов
private const val SLOT_SEARCH_WEEKS = 2

class ClientViewModel(
    val repo: SalonRepository,
    val loyalty: LoyaltyStore,
    private val auth: AuthRepository,
    val servicePhotos: ServicePhotos<ImageBitmap>,
) : ViewModel() {

    private val _load = MutableStateFlow<LoadState>(LoadState.Loading)
    val load: StateFlow<LoadState> = _load.asStateFlow()

    private val _nav = MutableStateFlow(NavState())
    val nav: StateFlow<NavState> = _nav.asStateFlow()

    private val _draft = MutableStateFlow<BookingDraft?>(null)
    val draft: StateFlow<BookingDraft?> = _draft.asStateFlow()

    private val _viewer = MutableStateFlow<PhotoViewer?>(null)
    val viewer: StateFlow<PhotoViewer?> = _viewer.asStateFlow()

    private val _toast = MutableStateFlow<Toast?>(null)
    val toast: StateFlow<Toast?> = _toast.asStateFlow()

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    private val _newsRefreshing = MutableStateFlow(false)
    val newsRefreshing: StateFlow<Boolean> = _newsRefreshing.asStateFlow()

    val client = repo.client
    val catalog = repo.catalog
    val bookings = repo.bookings
    val points = loyalty.points
    val news = repo.news
    val contacts = MockData.contacts

    private var slotsJob: Job? = null

    /** Вызывается при входе в основную часть; после выхода и повторного входа грузит данные заново. */
    fun start() {
        if (repo.client.value == null) {
            // Новая сессия (в т.ч. другой клиент после 401) — навигация с чистого листа
            _nav.value = NavState()
            _draft.value = null
            _viewer.value = null
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
            // Новости — отдельно и после основных данных: их ошибка показывается только во вкладке
            if (_load.value == LoadState.Ready) refreshNews()
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

    fun refreshNews() {
        viewModelScope.launch {
            _newsRefreshing.value = true
            try {
                repo.refreshNews()
            } catch (e: ApiException) {
                // Без ленты ошибка уже на экране (NewsState.Failed); тост — только если лента осталась старой
                if (repo.news.value is NewsState.Ready) showToast(errorMessage(e))
            } finally {
                _newsRefreshing.value = false
            }
        }
    }

    fun logout() {
        _viewer.value = null
        viewModelScope.launch {
            auth.logout()
            _load.value = LoadState.Loading
        }
    }

    // --- Навигация ---

    fun selectTab(tab: Tab) {
        _viewer.value = null
        _nav.update { it.copy(tab = tab, pushed = null) }
        // Записи могли измениться в салоне (подтверждение, отмена администратором),
        // новости — опубликованы или удалены в admin-app
        if (tab == Tab.BOOKINGS) refreshBookings()
        if (tab == Tab.NEWS) refreshNews()
    }

    fun openMaster(id: String) = _nav.update { it.copy(pushed = Pushed.MasterDetail(id)) }
    // Пустой список — просматривать нечего, просмотр не открывается
    fun openViewer(photoIds: List<String>, page: Int) {
        if (photoIds.isEmpty()) return
        _viewer.value = PhotoViewer(photoIds, page.coerceIn(0, photoIds.lastIndex))
    }

    // Страница, на которой остановился пользователь: переживает пересоздание Activity (поворот экрана)
    fun setViewerPage(page: Int) = _viewer.update { it?.copy(page = page) }
    fun closeViewer() { _viewer.value = null }
    fun openService(id: String) = _nav.update { it.copy(pushed = Pushed.ServiceDetail(id)) }
    fun openLoyalty() = _nav.update { it.copy(pushed = Pushed.Loyalty) }
    fun back() {
        _viewer.value = null
        _nav.update { it.copy(pushed = null) }
    }
    fun setBookingsUpcoming(upcoming: Boolean) = _nav.update { it.copy(bookingsShowUpcoming = upcoming) }
    fun setServicesCategory(categoryId: String?) = _nav.update { it.copy(servicesCategoryId = categoryId) }

    fun showToast(@StringRes message: Int) {
        _toast.value = Toast(message)
    }

    fun clearToast(toast: Toast) = _toast.update { if (it?.id == toast.id) null else it }

    // --- Запись ---

    /**
     * Открывает экран записи. [fromMaster] — вход из карточки мастера: мастер предвыбран, услуги сужены
     * до его услуг. Если в текущей неделе нет свободных слотов, календарь сам листает вперёд.
     */
    fun startBooking(serviceId: String? = null, masterId: String? = null, fromMaster: Boolean = false) {
        _viewer.value = null
        val catalog = catalog.value ?: return
        _draft.value = newBookingDraft(catalog, serviceId, masterId, fromMaster, LocalDate.now())
        loadWeek(autoAdvance = true)
    }

    fun closeBooking() {
        slotsJob?.cancel()
        _draft.value = null
    }

    fun selectDraftService(serviceId: String) {
        val catalog = catalog.value ?: return
        if (_draft.value?.serviceId == serviceId) return
        _draft.update { it?.withService(catalog, serviceId) }
        loadWeek(autoAdvance = false)
    }

    fun selectDraftMaster(masterId: String) {
        if (_draft.value?.masterId == masterId) return
        _draft.update { it?.withMaster(masterId) }
        loadWeek(autoAdvance = false)
    }

    // Слоты всей недели уже загружены — смена дня запроса не требует
    fun selectDraftDate(date: LocalDate) = _draft.update { it?.withDate(date) }

    fun showNextWeek() = changeWeek(+1)
    fun showPreviousWeek() = changeWeek(-1)

    private fun changeWeek(delta: Long) {
        val d = _draft.value ?: return
        val target = d.weekStart.plusWeeks(delta)
        if (delta < 0 && !canGoToPreviousWeek(d.weekStart, LocalDate.now())) return
        _draft.value = d.withWeek(target)
        loadWeek(autoAdvance = false)
    }

    fun retrySlots() = loadWeek(autoAdvance = false)

    fun selectDraftSlot(slot: Slot) = _draft.update { it?.copy(selectedSlot = slot) }

    private fun loadWeek(autoAdvance: Boolean) {
        slotsJob?.cancel()
        val initial = _draft.value ?: return
        val serviceId = initial.serviceId
        val masterId = initial.masterId
        if (serviceId == null || masterId == null) return
        _draft.update { it?.copy(week = WeekSlots.Loading, selectedSlot = null) }
        slotsJob = viewModelScope.launch {
            val today = LocalDate.now()
            try {
                var weekStart = initial.weekStart
                var days = fetchWeek(masterId, serviceId, weekStart, today)
                if (autoAdvance && days.values.none { it.slots.isNotEmpty() }) {
                    for (i in 1..SLOT_SEARCH_WEEKS) {
                        val next = initial.weekStart.plusWeeks(i.toLong())
                        val nextDays = fetchWeek(masterId, serviceId, next, today)
                        if (nextDays.values.any { it.slots.isNotEmpty() }) {
                            weekStart = next
                            days = nextDays
                            break
                        }
                    }
                }
                _draft.update {
                    it?.copy(
                        weekStart = weekStart,
                        week = WeekSlots.Ready(days),
                        date = pickDate(if (weekStart == it.weekStart) it.date else null, days, today),
                    )
                }
            } catch (e: ApiException) {
                _draft.update { it?.copy(week = WeekSlots.Failed(errorMessage(e))) }
            }
        }
    }

    /** Слоты на каждый ещё не прошедший день недели — параллельно; заодно дают выходные мастера. */
    private suspend fun fetchWeek(
        masterId: String,
        serviceId: String,
        weekStart: LocalDate,
        today: LocalDate,
    ): Map<LocalDate, DaySlots> = coroutineScope {
        weekDays(weekStart)
            .filterNot { it.isBefore(today) }
            .map { day -> async { day to repo.daySlots(masterId, serviceId, day) } }
            .awaitAll()
            .toMap()
    }

    fun confirmBooking() {
        val d = _draft.value ?: return
        if (!d.canConfirm) return
        val serviceId = d.serviceId ?: return
        val masterId = d.masterId ?: return
        val slot = d.selectedSlot ?: return
        _draft.update { it?.copy(submitting = true) }
        viewModelScope.launch {
            try {
                repo.createBooking(masterId, serviceId, slot)
                _draft.value = null
                _viewer.value = null
                _nav.update { it.copy(tab = Tab.BOOKINGS, pushed = null, bookingsShowUpcoming = true) }
                showToast(R.string.toast_booked)
            } catch (e: ApiException) {
                _draft.update { it?.copy(submitting = false) }
                if (e.kind == ApiException.Kind.CONFLICT) {
                    // Слот успели занять — перезагружаем слоты; услуга, мастер и день остаются, сбрасывается только время
                    showToast(R.string.error_slot_taken)
                    loadWeek(autoAdvance = false)
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
                ClientViewModel(container.salonRepository, container.loyaltyStore, container.authRepository, container.servicePhotos)
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
