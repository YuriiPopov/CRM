package com.beauty4you.client.data

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

/**
 * Фото услуг (item84): список id и сами картинки по одной (GET /client/service-photos/:id) — так же, как
 * в новостях (item75), картинки не приходят в списках услуг. Загрузка и декодирование идут вне главного
 * потока ([ioDispatcher] / [decodeDispatcher]), декодирование уменьшает картинку по короткой стороне
 * ([inSampleSize]). Три слоя кэша: декодированные картинки в памяти (лимит по байтам), сырые байты на диске
 * и общий запрос для одновременных обращений к одному фото.
 *
 * Тип картинки [T] — параметр, чтобы логика проверялась JVM unit-тестами без android.graphics
 * (в приложении это ImageBitmap).
 */
class ServicePhotos<T : Any>(
    private val fetchIds: suspend (serviceId: String) -> List<String>,
    private val fetchBytes: suspend (photoId: String) -> ByteArray,
    private val decode: (bytes: ByteArray, maxSide: Int) -> T?,
    private val diskCache: PhotoDiskCache,
    memoryBytes: Long,
    sizeOf: (T) -> Long,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val decodeDispatcher: CoroutineDispatcher = Dispatchers.Default,
) {
    private val memory = ByteLruCache<String, T>(memoryBytes, sizeOf)
    private val ids = ConcurrentHashMap<String, List<String>>()
    private val inFlight = ConcurrentHashMap<String, CompletableDeferred<ByteArray?>>()

    /**
     * Id фото услуги по порядку (первое — обложка). [expectedCount] — photoCount из каталога: если
     * закэшированный список другой длины, фото поменяли и список перечитывается. Ошибка сети пробрасывается.
     */
    suspend fun ids(serviceId: String, expectedCount: Int): List<String> {
        ids[serviceId]?.takeIf { it.size == expectedCount }?.let { return it }
        return fetchIds(serviceId).also { ids[serviceId] = it }
    }

    /** Картинка фото [photoId], уменьшенная под слот шириной [maxSide] px; null — не удалось загрузить или декодировать. */
    suspend fun bitmap(photoId: String, maxSide: Int): T? {
        val key = "$photoId:$maxSide"
        memory[key]?.let { return it }
        val bytes = bytes(photoId) ?: return null
        val decoded = withContext(decodeDispatcher) { decode(bytes, maxSide) } ?: return null
        memory.put(key, decoded)
        return decoded
    }

    /** Выход из аккаунта: фото салона прежнего клиента не должны остаться ни в памяти, ни на диске. */
    fun clear() {
        memory.removeIf { true }
        ids.clear()
        diskCache.clear()
    }

    // Диск → сеть. Одновременные запросы одного фото (миниатюра в списке и карточка) делят одну загрузку.
    private suspend fun bytes(photoId: String): ByteArray? {
        val mine = CompletableDeferred<ByteArray?>()
        val running = inFlight.putIfAbsent(photoId, mine)
        if (running != null) return running.await()
        try {
            val loaded = withContext(ioDispatcher) {
                diskCache.get(photoId) ?: runCatching { fetchBytes(photoId) }.getOrNull()?.also { diskCache.put(photoId, it) }
            }
            mine.complete(loaded)
            return loaded
        } catch (e: Throwable) {
            mine.complete(null)
            throw e
        } finally {
            inFlight.remove(photoId)
        }
    }
}
