package com.beauty4you.client.ui.home

import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.Category
import com.beauty4you.client.data.Service

// Чистая сборка блоков главной (item88) — покрыта HomeLogicTest.

const val MAX_YOUR_SERVICES = 6

/** Услуга в блоке «Twoje usługi»: [masterId] — мастер последнего визита, если он ещё делает эту услугу. */
data class YourService(val service: Service, val masterId: String?)

data class HomeBlocks(val yourServices: List<YourService>, val categories: List<Category>)

/**
 * Категории для главной: только те, в которых есть услуга хотя бы с одним мастером (на случай, если
 * backend отдал пустую), в порядке каталога.
 */
fun homeCategories(catalog: Catalog): List<Category> = catalog.categories.filter { category ->
    catalog.services.any { it.categoryId == category.id && catalog.mastersFor(it.id).isNotEmpty() }
}

/** Мастер последнего визита предвыбирается, только если он активен (есть в каталоге) и делает эту услугу. */
fun preferredMasterId(catalog: Catalog, serviceId: String, lastMasterId: String): String? =
    catalog.master(lastMasterId)?.takeIf { serviceId in it.serviceIds }?.id

/**
 * Новая клиентка — только категории. Постоянная — «Twoje usługi» (без повторов, сначала последние, не больше
 * [MAX_YOUR_SERVICES], услуги, которых нет в каталоге, пропускаются) и те же категории.
 */
fun buildHomeBlocks(catalog: Catalog): HomeBlocks {
    val yours = if (catalog.isNewClient) {
        emptyList()
    } else {
        catalog.clientServices
            .sortedByDescending { it.lastVisitAt }
            .distinctBy { it.serviceId }
            .mapNotNull { visit ->
                catalog.service(visit.serviceId)?.let { YourService(it, preferredMasterId(catalog, it.id, visit.lastMasterId)) }
            }
            .take(MAX_YOUR_SERVICES)
    }
    return HomeBlocks(yours, homeCategories(catalog))
}
