package com.beauty4you.master

import android.app.Application
import com.beauty4you.master.data.local.SessionDataStore
import com.beauty4you.master.data.remote.ApiService
import com.beauty4you.master.data.remote.NetworkModule
import com.beauty4you.master.data.repo.BookingsRepository
import com.beauty4you.master.data.repo.CatalogRepository
import com.beauty4you.master.data.repo.ScheduleRepository
import com.beauty4you.master.data.repo.SessionRepository
import com.beauty4you.master.data.repo.StaffRepository

// Ручной, минимальный service locator — без DI-фреймворка (Hilt и т.п. избыточны для одного
// приложения с горсткой репозиториев, см. тот же принцип "не переусложнять" в плане клиентского
// приложения).
class AppContainer(app: Application) {
    val session = SessionDataStore(app)
    private val api: ApiService = NetworkModule.createApiService(session)

    val sessionRepository = SessionRepository(api, session)
    private val catalogRepository = CatalogRepository(api)
    val bookingsRepository = BookingsRepository(api, catalogRepository)
    val staffRepository = StaffRepository(api)
    val scheduleRepository = ScheduleRepository(api)
}

class B4UMasterApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
