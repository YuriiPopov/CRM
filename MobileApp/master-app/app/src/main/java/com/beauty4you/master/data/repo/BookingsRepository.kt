package com.beauty4you.master.data.repo

import com.beauty4you.master.data.model.BookingDto
import com.beauty4you.master.data.remote.ApiService

class BookingsRepository(
    private val api: ApiService,
    private val catalog: CatalogRepository,
) {
    // GET /bookings уже скоуплен сервером на masterId текущего пользователя (см.
    // BookingsService.scopeWhere в бэкенде) — отдельный параметр не нужен.
    suspend fun listMyAppointments(): List<Appointment> {
        val bookings: List<BookingDto> = api.listMyBookings()
        return bookings.map { it.toAppointment() }.sortedBy { it.start }
    }

    suspend fun getAppointment(id: String): Appointment = api.getBooking(id).toAppointment()

    private suspend fun BookingDto.toAppointment() = Appointment(
        id = id,
        serviceName = catalog.serviceName(serviceId),
        clientName = catalog.clientName(clientId),
        status = status,
        start = Appointment.parseInstant(startTime),
        end = Appointment.parseInstant(endTime),
    )
}
