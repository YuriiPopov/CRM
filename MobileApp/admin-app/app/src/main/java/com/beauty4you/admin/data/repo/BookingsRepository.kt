package com.beauty4you.admin.data.repo

import com.beauty4you.admin.data.remote.ApiService
import com.beauty4you.admin.data.remote.CreateBookingRequest
import com.beauty4you.admin.data.remote.RescheduleRequest
import com.beauty4you.admin.data.remote.StatusRequest
import com.beauty4you.admin.data.remote.parseSalonTime
import com.beauty4you.admin.data.remote.toDomain
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.BookingStatus
import java.time.LocalDate
import java.time.LocalTime

data class DaySlots(val isWorkingDay: Boolean, val times: List<LocalTime>)

class BookingsRepository(private val api: ApiService) {

    // from — нижняя граница по startTime (полночь дня, салонное время с меткой UTC)
    suspend fun list(from: LocalDate? = null): List<Booking> =
        api.listBookings(from = from?.let { "${it}T00:00:00.000Z" }).mapNotNull { it.toDomain() }

    suspend fun listForClient(clientId: String): List<Booking> =
        api.listBookings(clientId = clientId).mapNotNull { it.toDomain() }

    suspend fun pendingOnlineCount(): Int = api.pendingOnlineCount().count

    suspend fun create(clientId: String, masterId: String, serviceId: String, startTime: String): Booking =
        api.createBooking(CreateBookingRequest(clientId, masterId, serviceId, startTime)).toDomain()!!

    suspend fun reschedule(id: String, startTime: String, masterId: String): Booking =
        api.rescheduleBooking(id, RescheduleRequest(startTime, masterId)).toDomain()!!

    suspend fun setStatus(id: String, status: BookingStatus): Booking =
        api.updateBookingStatus(id, StatusRequest(status.name)).toDomain()!!

    suspend fun freeSlots(masterId: String, serviceId: String, date: LocalDate): DaySlots {
        val response = api.availableSlots(masterId, serviceId, date.toString())
        return DaySlots(
            isWorkingDay = response.isWorkingDay,
            times = response.slots.map { parseSalonTime(it.startTime).toLocalTime() },
        )
    }
}
