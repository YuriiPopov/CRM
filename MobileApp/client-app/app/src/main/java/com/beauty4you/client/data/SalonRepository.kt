package com.beauty4you.client.data

import androidx.compose.ui.graphics.ImageBitmap
import com.beauty4you.client.data.remote.ClientApi
import com.beauty4you.client.data.remote.ApiException
import com.beauty4you.client.data.remote.CreateBookingBody
import com.beauty4you.client.data.remote.NewsDto
import com.beauty4you.client.data.remote.apiCall
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.ZoneId

/**
 * Данные клиента с backend (эндпоинты client/...): профиль, каталог салона, свободные слоты и собственные
 * записи, новости салона (item75). Лояльность на бэкенде пока не реализована — см. [LoyaltyStore] и [MockData].
 *
 * Новости грузятся отдельно от [refreshAll] (item75-fix): их ошибка видна только во вкладке
 * Aktualności и не мешает профилю, каталогу и записям. Картинки декодируются на [decodeDispatcher]
 * с уменьшением до [imageMaxSide] — не в главном потоке.
 */
class SalonRepository(
    private val api: ClientApi,
    private val decodePhoto: (dataUrl: String, maxSide: Int) -> ImageBitmap?,
    private val imageMaxSide: Int,
    private val decodeDispatcher: CoroutineDispatcher = Dispatchers.Default,
) {
    private val _client = MutableStateFlow<Client?>(null)
    val client: StateFlow<Client?> = _client.asStateFlow()

    private val _catalog = MutableStateFlow<Catalog?>(null)
    val catalog: StateFlow<Catalog?> = _catalog.asStateFlow()

    private val _bookings = MutableStateFlow<List<Booking>>(emptyList())
    val bookings: StateFlow<List<Booking>> = _bookings.asStateFlow()

    private val _news = MutableStateFlow<NewsState>(NewsState.Loading)
    val news: StateFlow<NewsState> = _news.asStateFlow()

    // Декодированные картинки новостей: ключ — id новости + хэш data URL (картинку могли заменить в
    // admin-app). Хранятся только картинки текущей ленты, удалённые новости выпадают при обновлении.
    private val newsImages = HashMap<String, ImageBitmap?>()
    private val newsMutex = Mutex()

    suspend fun refreshAll() = coroutineScope {
        val me = async { apiCall { api.me() } }
        val catalog = async { apiCall { api.catalog() } }
        val bookings = async { apiCall { api.bookings() } }
        _client.value = me.await().toDomain()
        val catalogDto = catalog.await()
        _catalog.value = withContext(decodeDispatcher) { catalogDto.toDomain { decodePhoto(it, imageMaxSide) } }
        _bookings.value = bookings.await().map { it.toDomain() }
    }

    /**
     * Перезагружает ленту. Ошибка при уже показанной ленте её не стирает (pull-to-refresh без сети),
     * а без ленты переводит вкладку в [NewsState.Failed]; в обоих случаях [ApiException] пробрасывается.
     */
    suspend fun refreshNews() {
        if (_news.value !is NewsState.Ready) _news.value = NewsState.Loading
        try {
            val dtos = apiCall { api.news() }
            _news.value = NewsState.Ready(newsMutex.withLock { withContext(decodeDispatcher) { decodeFeed(dtos) } })
        } catch (e: ApiException) {
            if (_news.value !is NewsState.Ready) _news.value = NewsState.Failed(e)
            throw e
        }
    }

    private fun decodeFeed(dtos: List<NewsDto>): List<NewsItem> {
        val wanted = dtos.mapNotNull { dto -> dto.imageUrl?.let { imageKey(dto.id, it) } }.toSet()
        newsImages.keys.retainAll(wanted)
        return dtos.toNewsFeed(
            decodeImage = { id, dataUrl ->
                val key = imageKey(id, dataUrl)
                if (key in newsImages) newsImages[key] else decodePhoto(dataUrl, imageMaxSide).also { newsImages[key] = it }
            },
            zone = ZoneId.systemDefault(),
        )
    }

    private fun imageKey(id: String, dataUrl: String) = "$id:${dataUrl.hashCode()}"

    suspend fun refreshBookings() {
        _bookings.value = apiCall { api.bookings() }.map { it.toDomain() }
    }

    suspend fun daySlots(masterId: String, serviceId: String, date: LocalDate): DaySlots {
        val response = apiCall { api.slots(masterId, serviceId, date.toString()) }
        return DaySlots(response.isWorkingDay, response.slots.map { it.toDomain() })
    }

    suspend fun createBooking(masterId: String, serviceId: String, slot: Slot): Booking {
        val booking = apiCall { api.createBooking(CreateBookingBody(masterId, serviceId, slot.startIso)) }.toDomain()
        _bookings.update { listOf(booking) + it }
        return booking
    }

    suspend fun cancelBooking(id: String) {
        val updated = apiCall { api.cancelBooking(id) }.toDomain()
        _bookings.update { list -> list.map { if (it.id == id) updated else it } }
    }

    fun clear() {
        _client.value = null
        _catalog.value = null
        _bookings.value = emptyList()
        _news.value = NewsState.Loading
        newsImages.clear()
    }
}

/** Состояние вкладки Aktualności: загрузка → лента (возможно пустая) или ошибка с повтором. */
sealed interface NewsState {
    data object Loading : NewsState
    data class Failed(val error: ApiException) : NewsState
    data class Ready(val items: List<NewsItem>) : NewsState
}
