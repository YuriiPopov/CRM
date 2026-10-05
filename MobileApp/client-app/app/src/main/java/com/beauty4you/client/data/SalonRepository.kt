package com.beauty4you.client.data

import androidx.compose.ui.graphics.ImageBitmap
import com.beauty4you.client.data.remote.ClientApi
import com.beauty4you.client.data.remote.CreateBookingBody
import com.beauty4you.client.data.remote.apiCall
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.LocalDate
import java.time.ZoneId

/**
 * Данные клиента с backend (эндпоинты client/...): профиль, каталог салона, свободные слоты и собственные
 * записи, новости салона (item75). Лояльность на бэкенде пока не реализована — см. [LoyaltyStore] и [MockData].
 */
class SalonRepository(
    private val api: ClientApi,
    private val decodePhoto: (String) -> ImageBitmap?,
) {
    private val _client = MutableStateFlow<Client?>(null)
    val client: StateFlow<Client?> = _client.asStateFlow()

    private val _catalog = MutableStateFlow<Catalog?>(null)
    val catalog: StateFlow<Catalog?> = _catalog.asStateFlow()

    private val _bookings = MutableStateFlow<List<Booking>>(emptyList())
    val bookings: StateFlow<List<Booking>> = _bookings.asStateFlow()

    private val _news = MutableStateFlow<List<NewsItem>>(emptyList())
    val news: StateFlow<List<NewsItem>> = _news.asStateFlow()

    suspend fun refreshAll() = coroutineScope {
        val me = async { apiCall { api.me() } }
        val catalog = async { apiCall { api.catalog() } }
        val bookings = async { apiCall { api.bookings() } }
        val news = async { apiCall { api.news() } }
        _client.value = me.await().toDomain()
        _catalog.value = catalog.await().toDomain(decodePhoto)
        _bookings.value = bookings.await().map { it.toDomain() }
        _news.value = news.await().toNewsFeed(decodePhoto, ZoneId.systemDefault())
    }

    suspend fun refreshNews() {
        _news.value = apiCall { api.news() }.toNewsFeed(decodePhoto, ZoneId.systemDefault())
    }

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
        _news.value = emptyList()
    }
}
