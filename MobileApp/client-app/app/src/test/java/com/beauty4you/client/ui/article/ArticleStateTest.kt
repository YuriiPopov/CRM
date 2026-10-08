package com.beauty4you.client.ui.article

import com.beauty4you.client.data.NewsArticle
import com.beauty4you.client.data.remote.ApiException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// item89: состояния экрана статьи — готово, пустая статья, ошибка (с повтором), загрузка
class ArticleStateTest {

    private fun article(html: String?) = NewsArticle("n1", "Tytuł", html)

    @Test
    fun `article with content is ready`() = runTest {
        assertEquals(ArticleState.Ready("<p>x</p>"), loadArticleState { article("<p>x</p>") })
    }

    @Test
    fun `missing or blank content is the empty state`() = runTest {
        assertEquals(ArticleState.Empty, loadArticleState { article(null) })
        assertEquals(ArticleState.Empty, loadArticleState { article("") })
        assertEquals(ArticleState.Empty, loadArticleState { article("  \n ") })
    }

    @Test
    fun `api errors become the failed state with the original error`() = runTest {
        val network = ApiException(ApiException.Kind.NETWORK)
        val state = loadArticleState { throw network }

        assertTrue(state is ArticleState.Failed)
        assertEquals(network, (state as ArticleState.Failed).error)
    }

    @Test
    fun `a retry after a failure can succeed`() = runTest {
        var online = false
        val load: suspend () -> NewsArticle = {
            if (!online) throw ApiException(ApiException.Kind.NETWORK)
            article("<p>x</p>")
        }

        assertTrue(loadArticleState(load) is ArticleState.Failed)
        online = true
        assertEquals(ArticleState.Ready("<p>x</p>"), loadArticleState(load))
    }

    @Test
    fun `unexpected errors are not swallowed`() = runTest {
        var thrown: Throwable? = null
        try {
            loadArticleState { throw IllegalStateException("boom") }
        } catch (e: IllegalStateException) {
            thrown = e
        }
        assertEquals("boom", thrown?.message)
    }
}
