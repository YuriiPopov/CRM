package com.beauty4you.admin.domain

// Фото услуги в форме (item84). Saved — уже на сервере (key = id фото), New — выбрано в галерее
// и ещё не отправлено (key локальный). Правки фото копятся в форме и уходят на сервер по «Zapisz».
data class ServicePhotoDraft(val key: String, val serverId: String?, val dataUrl: String) {
    val isNew: Boolean get() = serverId == null
}

// Шаги сохранения по порядку: удалить → загрузить новые → переставить. Удаляем раньше загрузки,
// чтобы не упереться в лимит 5 на сервере.
data class ServicePhotosPlan(
    val deleteIds: List<String> = emptyList(),
    val uploads: List<ServicePhotoDraft> = emptyList(),
    val reorder: Boolean = false,
) {
    val isNoop: Boolean get() = deleteIds.isEmpty() && uploads.isEmpty() && !reorder
}

// Логика блока «Zdjęcia» — чистый Kotlin, проверяется JVM unit-тестами. Лимиты — те же, что проверяет
// бэкенд (ServicePhotosService): до 5 фото, до 1 МБ после декодирования base64.
object ServicePhotosLogic {
    const val MAX_PHOTOS = 5
    const val MAX_BYTES = 1024 * 1024

    fun canAdd(count: Int): Boolean = count < MAX_PHOTOS

    fun tooLarge(dataUrl: String): Boolean = NewsFormLogic.imageBytes(dataUrl) > MAX_BYTES

    fun fromServer(photos: List<Pair<String, String>>): List<ServicePhotoDraft> =
        photos.map { (id, image) -> ServicePhotoDraft(key = id, serverId = id, dataUrl = image) }

    // Перенос на delta позиций (−1 влево, +1 вправо); на краю — без изменений
    fun move(photos: List<ServicePhotoDraft>, key: String, delta: Int): List<ServicePhotoDraft> {
        val from = photos.indexOfFirst { it.key == key }
        val to = from + delta
        if (from < 0 || to !in photos.indices) return photos
        return photos.toMutableList().apply { add(to, removeAt(from)) }
    }

    fun remove(photos: List<ServicePhotoDraft>, key: String): List<ServicePhotoDraft> = photos.filterNot { it.key == key }

    // «Odrzucić zmiany?»: добавили, удалили или переставили фото относительно того, что на сервере
    fun isDirty(initial: List<ServicePhotoDraft>, photos: List<ServicePhotoDraft>): Boolean =
        initial.map { it.key } != photos.map { it.key }

    fun planSave(initial: List<ServicePhotoDraft>, photos: List<ServicePhotoDraft>): ServicePhotosPlan {
        val wanted = photos.map { it.key }
        val deleteIds = initial.filter { it.key !in wanted }.mapNotNull { it.serverId }
        val uploads = photos.filter { it.isNew }
        // После удаления и загрузок сервер хранит: оставшиеся в прежнем порядке + новые по очереди
        val serverOrder = initial.filter { it.key in wanted }.map { it.key } + uploads.map { it.key }
        return ServicePhotosPlan(deleteIds, uploads, reorder = serverOrder != wanted)
    }

    // Порядок id для PUT /services/:id/photos/order: новые фото — по ключу выбора → id, выданному сервером
    fun orderIds(photos: List<ServicePhotoDraft>, uploadedIds: Map<String, String>): List<String> =
        photos.map { it.serverId ?: uploadedIds.getValue(it.key) }

    // Ошибка шага работы с фото (сервер отвечает 400 с понятным message: формат, 1 МБ, лимит 5)
    fun mapError(httpCode: Int?): CatalogError = when (httpCode) {
        null -> CatalogError.NETWORK
        400 -> CatalogError.SERVICE_PHOTO_INVALID
        404 -> CatalogError.NOT_FOUND
        else -> CatalogError.UNKNOWN
    }
}
