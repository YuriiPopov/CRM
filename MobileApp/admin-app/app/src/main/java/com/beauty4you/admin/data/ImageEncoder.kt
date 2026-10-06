package com.beauty4you.admin.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.util.Base64
import com.beauty4you.admin.domain.NewsFormLogic
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

// Фото с камеры или из галереи -> JPEG base64 data URL для POST /news/:id/image.
// Как и фото мастера (item41), сжимаем на устройстве: снимок камеры весит 3–8 МБ, а сервер
// принимает до 5 МБ и хранит картинку прямо в БД; 1600 px по длинной стороне хватает для
// карточки во всю ширину экрана.
class ImageEncoder(private val context: Context) {

    // Фото мастера (item76) — меньше: аватар на экране не больше 64 dp, сервер принимает до 2 МБ
    suspend fun encode(
        uri: Uri,
        maxSide: Int = MAX_SIDE,
        maxBytes: Int = NewsFormLogic.IMAGE_MAX_BYTES,
    ): String? = withContext(Dispatchers.IO) {
        runCatching {
            val bitmap = decode(uri, maxSide) ?: return@runCatching null
            var quality = START_QUALITY
            var bytes = compress(bitmap, quality)
            while (bytes.size > maxBytes && quality > MIN_QUALITY) {
                quality -= QUALITY_STEP
                bytes = compress(bitmap, quality)
            }
            bitmap.recycle()
            if (bytes.size > maxBytes) return@runCatching null
            // NO_WRAP: сервер проверяет data URL регулярным выражением без переводов строк
            "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
        }.getOrNull()
    }

    private fun decode(uri: Uri, maxSide: Int): Bitmap? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // ImageDecoder сам учитывает EXIF-поворот снимка камеры
            ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, info, _ ->
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                val scale = maxSide.toFloat() / maxOf(info.size.width, info.size.height)
                if (scale < 1f) decoder.setTargetSize((info.size.width * scale).toInt(), (info.size.height * scale).toInt())
            }
        } else {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
            val options = BitmapFactory.Options().apply { inSampleSize = sample }
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
        }

    private fun compress(bitmap: Bitmap, quality: Int): ByteArray =
        ByteArrayOutputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
            out.toByteArray()
        }

    companion object {
        const val MAX_SIDE = 1600
        const val MASTER_PHOTO_SIDE = 640
        private const val START_QUALITY = 85
        private const val MIN_QUALITY = 40
        private const val QUALITY_STEP = 15
    }
}
