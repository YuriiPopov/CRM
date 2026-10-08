package com.beauty4you.client.ui.article

import com.beauty4you.client.data.NewsArticle
import com.beauty4you.client.data.remote.ApiException

/** Состояния экрана статьи: загрузка, ошибка с «Повторить», пустая статья, готово. */
sealed interface ArticleState {
    data object Loading : ArticleState
    data class Failed(val error: ApiException) : ArticleState
    data object Empty : ArticleState
    data class Ready(val html: String) : ArticleState
}

/** Статья без содержимого (hasArticle был true, но потом её убрали) показывается как пустая. */
fun NewsArticle.toState(): ArticleState =
    if (html.isNullOrBlank()) ArticleState.Empty else ArticleState.Ready(html)

/** Загружает статью и сводит результат или [ApiException] к состоянию экрана. */
suspend fun loadArticleState(load: suspend () -> NewsArticle): ArticleState =
    try {
        load().toState()
    } catch (e: ApiException) {
        ArticleState.Failed(e)
    }
