package com.beauty4you.client

import android.app.Application
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.beauty4you.client.data.AuthRepository
import com.beauty4you.client.data.LoyaltyStore
import com.beauty4you.client.data.SalonRepository
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
    val salonRepository = SalonRepository(api, ::decodeDataUrl)
    val loyaltyStore = LoyaltyStore()

    init {
        // Токен сброшен (выход или 401 из AuthInterceptor) — данные прежнего клиента не должны
        // мелькнуть у того, кто войдёт следующим.
        CoroutineScope(SupervisorJob() + Dispatchers.Main).launch {
            session.accessToken.filter { it == null }.collect { salonRepository.clear() }
        }
    }
}

/** "data:image/webp;base64,...." → ImageBitmap (фото мастера хранится в БД как data URL, item41). */
private fun decodeDataUrl(dataUrl: String): ImageBitmap? = runCatching {
    val bytes = Base64.decode(dataUrl.substringAfter("base64,"), Base64.DEFAULT)
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
}.getOrNull()

class B4UClientApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
