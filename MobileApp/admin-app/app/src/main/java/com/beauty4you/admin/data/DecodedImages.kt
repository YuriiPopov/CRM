package com.beauty4you.admin.data

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.beauty4you.admin.domain.ImageSampling
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Декодированные фото мастеров и картинки новостей (base64 data URL, item41/item75). Кэш ограничен
// ~1/8 памяти процесса (item75-fix): картинка новости 1600 px — это ~7–8 МБ в памяти, без лимита
// длинная лента или несколько замен картинки роняли приложение по OutOfMemory.
object DecodedImages {

    private val cache = ByteLruCache<String, ImageBitmap>(
        maxBytes = Runtime.getRuntime().maxMemory() / 8,
        sizeOf = { it.width.toLong() * it.height * 4 },
    )

    suspend fun decode(dataUrl: String, maxSidePx: Int): ImageBitmap? = withContext(Dispatchers.Default) {
        val key = key(dataUrl, maxSidePx)
        cache[key]?.let { return@withContext it }
        runCatching {
            val bytes = Base64.decode(dataUrl.substringAfter(",", dataUrl), Base64.DEFAULT)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            val options = BitmapFactory.Options().apply {
                inSampleSize = ImageSampling.inSampleSize(bounds.outWidth, bounds.outHeight, maxSidePx)
            }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.asImageBitmap()
        }.getOrNull()?.also { cache.put(key, it) }
    }

    // Картинку заменили или удалили — её декодированные копии (любого размера) больше не нужны
    fun evict(dataUrl: String?) {
        if (dataUrl == null) return
        val prefix = "${dataUrl.hashCode()}:"
        cache.removeIf { it.startsWith(prefix) }
    }

    private fun key(dataUrl: String, maxSidePx: Int) = "${dataUrl.hashCode()}:$maxSidePx"
}
