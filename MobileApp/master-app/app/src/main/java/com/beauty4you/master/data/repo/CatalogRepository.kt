package com.beauty4you.master.data.repo

import com.beauty4you.master.data.model.ClientDto
import com.beauty4you.master.data.model.ServiceDto
import com.beauty4you.master.data.remote.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// GET /bookings отдаёт только clientId/serviceId (без вложенных relations — см. Booking-модель
// бэкенда и одноимённый тип во фронтенде), поэтому имена клиента/услуги подтягиваются здесь и
// джойнятся на устройстве, как это уже делает веб-фронтенд.
class CatalogRepository(private val api: ApiService) {

    private val mutex = Mutex()
    private var clientsById: Map<String, ClientDto> = emptyMap()
    private var servicesById: Map<String, ServiceDto> = emptyMap()
    private var loaded = false

    private suspend fun ensureLoaded() {
        if (loaded) return
        mutex.withLock {
            if (loaded) return@withLock
            clientsById = api.listClients().associateBy { it.id }
            servicesById = api.listServices().associateBy { it.id }
            loaded = true
        }
    }

    suspend fun refresh() {
        mutex.withLock { loaded = false }
        ensureLoaded()
    }

    suspend fun clientName(clientId: String): String {
        ensureLoaded()
        return clientsById[clientId]?.name ?: "—"
    }

    suspend fun serviceName(serviceId: String): String {
        ensureLoaded()
        return servicesById[serviceId]?.name ?: "—"
    }
}
