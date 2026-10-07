package com.beauty4you.client

import android.app.Application
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.beauty4you.client.data.AuthRepository
import com.beauty4you.client.data.LoyaltyStore
import com.beauty4you.client.data.PhotoDiskCache
import com.beauty4you.client.data.ServicePhotos
import com.beauty4you.client.data.remote.apiCall
import java.io.File
import com.beauty4you.client.data.SalonRepository
import com.beauty4you.client.data.inSampleSize
import com.beauty4you.client.data.local.SessionStore
import com.beauty4you.client.data.remote.NetworkModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch

// Ручной service locator без DI-фреймворка — как и в master-app.
class AppContainer(app: Application) {
    val session = SessionStore(app)
    private val api = NetworkModule.createClientApi(session)

    val authRepository = AuthRepository(api, session)
    // Картинки ленты показываются во всю ширину экрана — больше пикселей в память не грузим
    val salonRepository = SalonRepository(api, ::decodeDataUrl, imageMaxSide = app.resources.displayMetrics.widthPixels)
    val loyaltyStore = LoyaltyStore()

    // Фото услуг (item84): по одной через GET /client/service-photos/:id, кэш в памяти (1/8 heap) и на диске (20 МБ)
    val servicePhotos = ServicePhotos<ImageBitmap>(
        fetchIds = { serviceId -> apiCall { api.servicePhotos(serviceId) }.sortedBy { it.position }.map { it.id } },
        fetchBytes = { photoId -> apiCall { api.servicePhoto(photoId) }.use { it.bytes() } },
        decode = { bytes, maxSide -> decodeBytes(bytes, maxSide) },
        diskCache = PhotoDiskCache(File(app.cacheDir, "service_photos"), maxBytes = 20L * 1024 * 1024),
        memoryBytes = Runtime.getRuntime().maxMemory() / 8,
        sizeOf = { it.width.toLong() * it.height * 4 },
    )

    init {
        // Токен сброшен (выход или 401 из AuthInterceptor) — данные прежнего клиента не должны
        // мелькнуть у того, кто войдёт следующим.
        CoroutineScope(SupervisorJob() + Dispatchers.Main).launch {
            session.accessToken.filter { it == null }.collect {
                salonRepository.clear()
                servicePhotos.clear()
            }
        }
    }
}

/**
 * "data:image/webp;base64,...." → ImageBitmap (фото мастера и картинка новости хранятся в БД как
 * data URL, item41/item75), с уменьшением так, чтобы короткая сторона была не меньше [maxSide], — см. [inSampleSize].
 * Вызывается из SalonRepository на Dispatchers.Default, не в главном потоке.
 */
private fun decodeDataUrl(dataUrl: String, maxSide: Int): ImageBitmap? =
    runCatching { decodeBytes(Base64.decode(dataUrl.substringAfter("base64,"), Base64.DEFAULT), maxSide) }.getOrNull()

/** Байты картинки → ImageBitmap с [inSampleSize] по короткой стороне; не для главного потока. */
private fun decodeBytes(bytes: ByteArray, maxSide: Int): ImageBitmap? = runCatching {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    val options = BitmapFactory.Options().apply { inSampleSize = inSampleSize(bounds.outWidth, bounds.outHeight, maxSide) }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.asImageBitmap()
}.getOrNull()

class B4UClientApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
