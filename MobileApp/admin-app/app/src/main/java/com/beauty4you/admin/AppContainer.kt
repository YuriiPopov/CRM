package com.beauty4you.admin

import android.app.Application
import androidx.annotation.StringRes
import com.beauty4you.admin.data.ImageEncoder
import com.beauty4you.admin.data.local.SessionDataStore
import com.beauty4you.admin.data.remote.ApiService
import com.beauty4you.admin.data.remote.NetworkModule
import com.beauty4you.admin.data.repo.BookingsRepository
import com.beauty4you.admin.data.repo.CatalogRepository
import com.beauty4you.admin.data.repo.NewsRepository
import com.beauty4you.admin.data.repo.ScheduleRepository
import com.beauty4you.admin.data.repo.SessionRepository
import com.beauty4you.admin.domain.BookingStatus
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDate

// Переход в Kalendarz с заранее выставленным фильтром (тап «Czekają na potwierdzenie» на Panel)
data class CalendarRequest(val status: BookingStatus?, val date: LocalDate?)

// Межэкранные события: экраны живут в разных вкладках bottom nav, а форма визита — поверх них
class AppEvents {
    private val _dataChanged = MutableSharedFlow<Unit>(extraBufferCapacity = 4)
    val dataChanged: SharedFlow<Unit> = _dataChanged.asSharedFlow()

    private val _toasts = MutableSharedFlow<Int>(extraBufferCapacity = 4)
    val toasts: SharedFlow<Int> = _toasts.asSharedFlow()

    private val _calendarRequest = MutableStateFlow<CalendarRequest?>(null)
    val calendarRequest: StateFlow<CalendarRequest?> = _calendarRequest.asStateFlow()

    // Запись/клиент изменены — экраны молча перезагружают данные
    fun notifyDataChanged() {
        _dataChanged.tryEmit(Unit)
    }

    fun toast(@StringRes message: Int) {
        _toasts.tryEmit(message)
    }

    fun requestCalendar(request: CalendarRequest) {
        _calendarRequest.value = request
    }

    fun consumeCalendarRequest(): CalendarRequest? = _calendarRequest.value.also { _calendarRequest.value = null }
}

// Ручной service locator без DI-фреймворка — как в master-app
class AppContainer(app: Application) {
    private val session = SessionDataStore(app)
    private val api: ApiService = NetworkModule.createApiService(session)

    val sessionRepository = SessionRepository(api, session)
    val catalogRepository = CatalogRepository(api)
    val bookingsRepository = BookingsRepository(api)
    val scheduleRepository = ScheduleRepository(api)
    val newsRepository = NewsRepository(api)
    val imageEncoder = ImageEncoder(app)
    val events = AppEvents()
}

class B4UAdminApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
