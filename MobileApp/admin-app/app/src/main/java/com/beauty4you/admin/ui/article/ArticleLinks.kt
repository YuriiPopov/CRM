package com.beauty4you.admin.ui.article

/** Что делать с ссылкой, по которой нажали в статье (item89). */
sealed interface ArticleLink {
    /** `#якорь` внутри статьи — WebView прокручивает сам (JavaScript выключен). */
    data object InPage : ArticleLink

    /** `#book` — экран записи приложения. */
    data object Book : ArticleLink

    /** `https:` — во внешнем браузере. */
    data class External(val url: String) : ArticleLink

    /** Всё остальное (http:, tel:, mailto:, intent:, file:, javascript:, …) блокируется. */
    data object Blocked : ArticleLink
}

object ArticleLinks {
    const val BOOK_ID = "book"

    // Страница грузится через loadDataWithBaseURL(null, …): базовый адрес — about:blank (или data:-URL
    // страницы), поэтому WebView отдаёт href="#shade-1" как "about:blank#shade-1"
    private const val PAGE_URL = "about:blank"
    private val HTTPS = Regex("^https://[^/?#\\s]+", RegexOption.IGNORE_CASE)

    fun classify(url: String?): ArticleLink {
        val value = url?.trim().orEmpty()
        if (value.isEmpty()) return ArticleLink.Blocked

        val fragment = when {
            value.startsWith("#") -> value.substring(1)
            value.startsWith("$PAGE_URL#") -> value.substring(PAGE_URL.length + 1)
            // На части версий WebView базовый адрес документа — сам data:-URL страницы
            value.startsWith("data:text/html", ignoreCase = true) && '#' in value -> value.substringAfterLast('#')
            else -> null
        }
        if (fragment != null) {
            return if (fragment == BOOK_ID) ArticleLink.Book else ArticleLink.InPage
        }
        return if (HTTPS.containsMatchIn(value)) ArticleLink.External(value) else ArticleLink.Blocked
    }
}
