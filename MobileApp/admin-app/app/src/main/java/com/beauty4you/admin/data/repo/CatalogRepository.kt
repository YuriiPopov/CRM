package com.beauty4you.admin.data.repo

import com.beauty4you.admin.data.remote.ApiService
import com.beauty4you.admin.data.remote.CreateClientRequest
import com.beauty4you.admin.data.remote.toDomain
import com.beauty4you.admin.domain.Category
import com.beauty4you.admin.domain.Client
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.Service
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// Справочники салона: мастера, услуги, категории, клиенты. Записи (GET /bookings) отдают только
// *Id — имена джойнятся на устройстве по этим справочникам, как в веб-CRM.
data class Catalog(
    val masters: List<Master>,
    val services: List<Service>,
    val categories: List<Category>,
    val clients: List<Client>,
) {
    val mastersById: Map<String, Master> = masters.associateBy { it.id }
    val servicesById: Map<String, Service> = services.associateBy { it.id }
    val clientsById: Map<String, Client> = clients.associateBy { it.id }
    val categoriesById: Map<String, Category> = categories.associateBy { it.id }

    fun masterName(id: String): String = mastersById[id]?.name ?: "—"
    fun serviceName(id: String): String = servicesById[id]?.name ?: "—"
    fun clientName(id: String): String = clientsById[id]?.name ?: "—"
}

class CatalogRepository(private val api: ApiService) {

    private val mutex = Mutex()
    private var cached: Catalog? = null

    // force — при pull-to-refresh/возврате на экран, чтобы подхватить изменения из веб-CRM
    suspend fun get(force: Boolean = false): Catalog = mutex.withLock {
        cached?.takeIf { !force }?.let { return@withLock it }
        coroutineScope {
            val masters = async { api.listStaff().map { it.toDomain() }.sortedBy { it.name.lowercase() } }
            val services = async { api.listServices().map { it.toDomain() }.sortedBy { it.name.lowercase() } }
            val categories = async { api.listCategories().map { it.toDomain() } }
            val clients = async { api.listClients().map { it.toDomain() }.sortedBy { it.name.lowercase() } }
            Catalog(masters.await(), services.await(), categories.await(), clients.await())
        }.also { cached = it }
    }

    suspend fun getClient(id: String): Client = api.getClient(id).toDomain()

    suspend fun createClient(name: String, phone: String, consentGiven: Boolean): Client {
        val created = api.createClient(CreateClientRequest(name, phone, consentGiven)).toDomain()
        // Новый клиент должен сразу быть доступен в форме визита
        mutex.withLock {
            cached = cached?.let { it.copy(clients = (it.clients + created).sortedBy { c -> c.name.lowercase() }) }
        }
        return created
    }
}
