package com.beauty4you.client.data

import com.beauty4you.client.data.remote.BookingDto
import com.beauty4you.client.data.remote.CatalogDto
import com.beauty4you.client.data.remote.ClientApi
import com.beauty4you.client.data.remote.ClientDto
import com.beauty4you.client.data.remote.CreateBookingBody
import com.beauty4you.client.data.remote.NewsDto
import com.beauty4you.client.data.remote.RequestCodeBody
import com.beauty4you.client.data.remote.RequestCodeResponse
import com.beauty4you.client.data.remote.SalonDto
import com.beauty4you.client.data.remote.SlotsResponse
import com.beauty4you.client.data.remote.VerifyCodeBody
import com.beauty4you.client.data.remote.VerifyCodeResponse
import com.beauty4you.client.data.remote.ApiException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import com.beauty4you.client.data.remote.ServicePhotoDto
import okhttp3.ResponseBody
import java.io.IOException

// item75-fix: новости грузятся отдельно — их ошибка не ломает профиль, каталог и записи
class SalonRepositoryTest {

    private class FakeApi : ClientApi {
        var newsCalls = 0
        var newsResult: () -> List<NewsDto> = { emptyList() }
        var newsGate: CompletableDeferred<Unit>? = null // ответ «в пути», пока гейт не открыт

        override suspend fun requestCode(body: RequestCodeBody): RequestCodeResponse = error("unused")
        override suspend fun verify(body: VerifyCodeBody): VerifyCodeResponse = error("unused")
        override suspend fun me() = ClientDto(id = "c1", name = "Anna Nowak", phone = "+48601234567")
        override suspend fun catalog() = CatalogDto(SalonDto("B4U"), emptyList(), emptyList(), emptyList())
        override suspend fun slots(masterId: String, serviceId: String, date: String): SlotsResponse = error("unused")
        override suspend fun bookings(): List<BookingDto> = emptyList()
        override suspend fun createBooking(body: CreateBookingBody): BookingDto = error("unused")
        override suspend fun cancelBooking(id: String): BookingDto = error("unused")
        override suspend fun servicePhotos(serviceId: String): List<ServicePhotoDto> = error("unused")
        override suspend fun servicePhoto(photoId: String): ResponseBody = error("unused")
        override suspend fun news(): List<NewsDto> {
            newsCalls++
            newsGate?.await()
            return newsResult()
        }
    }

    private fun http(code: Int) = HttpException(Response.error<Any>(code, "".toResponseBody()))

    private fun news(id: String, imageUrl: String? = null) =
        NewsDto(id, "NOWOSC", "Tytuł", "Treść", imageUrl, "2026-10-05T10:00:00.000Z")

    private val decoded = mutableListOf<String>()
    private var onDecode: () -> Unit = {}

    private fun repo(api: FakeApi, dispatcher: TestDispatcher) =
        SalonRepository(
            api,
            { dataUrl, _ -> decoded += dataUrl; onDecode(); null },
            imageMaxSide = 1080,
            decodeDispatcher = dispatcher,
        )

    @Test
    fun `general load does not request news and succeeds while news fail`() = runTest {
        val api = FakeApi().apply { newsResult = { throw http(404) } }
        val repo = repo(api, StandardTestDispatcher(testScheduler))

        repo.refreshAll()

        assertEquals(0, api.newsCalls)
        assertNotNull(repo.client.value)
        assertNotNull(repo.catalog.value)
    }

    @Test
    fun `news error is kept in the news state only`() = runTest {
        for (failure in listOf(http(404), http(500), IOException("offline"))) {
            val api = FakeApi().apply { newsResult = { throw failure } }
            val repo = repo(api, StandardTestDispatcher(testScheduler))
            repo.refreshAll()

            try {
                repo.refreshNews()
                fail("refreshNews should rethrow")
            } catch (e: ApiException) {
                // ожидаемо — ViewModel решает, показывать ли тост
            }

            assertTrue(repo.news.value is NewsState.Failed)
            assertNotNull(repo.client.value)
            assertNotNull(repo.catalog.value)
        }
    }

    @Test
    fun `retry after an error shows the feed`() = runTest {
        val api = FakeApi().apply { newsResult = { throw http(500) } }
        val repo = repo(api, StandardTestDispatcher(testScheduler))
        runCatching { repo.refreshNews() }

        api.newsResult = { listOf(news("n1")) }
        repo.refreshNews()

        assertEquals(listOf("n1"), (repo.news.value as NewsState.Ready).items.map { it.id })
    }

    @Test
    fun `failed pull-to-refresh keeps the feed already on screen`() = runTest {
        val api = FakeApi().apply { newsResult = { listOf(news("n1")) } }
        val repo = repo(api, StandardTestDispatcher(testScheduler))
        repo.refreshNews()

        api.newsResult = { throw IOException("offline") }
        runCatching { repo.refreshNews() }

        assertEquals(listOf("n1"), (repo.news.value as NewsState.Ready).items.map { it.id })
    }

    @Test
    fun `news images are decoded once per news id and image`() = runTest {
        val api = FakeApi().apply { newsResult = { listOf(news("n1", "data:image/jpeg;base64,AAAA"), news("n2")) } }
        val repo = repo(api, StandardTestDispatcher(testScheduler))

        repo.refreshNews()
        repo.refreshNews()
        assertEquals(listOf("data:image/jpeg;base64,AAAA"), decoded)

        // Картинку заменили в admin-app — декодируется заново
        api.newsResult = { listOf(news("n1", "data:image/jpeg;base64,BBBB")) }
        repo.refreshNews()
        assertEquals(listOf("data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"), decoded)
    }

    @Test
    fun `logout clears the news`() = runTest {
        val api = FakeApi().apply { newsResult = { listOf(news("n1")) } }
        val repo = repo(api, StandardTestDispatcher(testScheduler))
        repo.refreshNews()

        repo.clear()

        assertEquals(NewsState.Loading, repo.news.value)
    }

    @Test
    fun `news requested before logout do not reach the next client`() = runTest {
        val gate = CompletableDeferred<Unit>()
        val api = FakeApi().apply {
            newsResult = { listOf(news("old")) }
            newsGate = gate
        }
        val repo = repo(api, StandardTestDispatcher(testScheduler))
        val refresh = launch { repo.refreshNews() }
        advanceUntilIdle()

        repo.clear() // выход, пока /client/news ещё в пути
        gate.complete(Unit)
        refresh.join()

        assertEquals(NewsState.Loading, repo.news.value)
    }

    @Test
    fun `logout while images are decoding drops the old feed`() = runTest {
        val api = FakeApi().apply { newsResult = { listOf(news("old", "data:image/jpeg;base64,AAAA")) } }
        val repo = repo(api, StandardTestDispatcher(testScheduler))
        onDecode = { repo.clear() } // clear() из главного потока посреди декодирования

        repo.refreshNews()

        assertEquals(NewsState.Loading, repo.news.value)

        // Следующий клиент получает свою ленту, картинка декодируется заново — кэш прежнего не используется
        onDecode = {}
        repo.refreshNews()
        assertEquals(listOf("old"), (repo.news.value as NewsState.Ready).items.map { it.id })
        assertEquals(2, decoded.size)
    }

    @Test
    fun `error of a request made before logout is swallowed`() = runTest {
        val gate = CompletableDeferred<Unit>()
        val api = FakeApi().apply {
            newsResult = { throw http(401) }
            newsGate = gate
        }
        val repo = repo(api, StandardTestDispatcher(testScheduler))
        val refresh = launch { repo.refreshNews() } // исключение уронило бы runTest
        advanceUntilIdle()

        repo.clear()
        gate.complete(Unit)
        refresh.join()

        assertEquals(NewsState.Loading, repo.news.value)
    }
}
