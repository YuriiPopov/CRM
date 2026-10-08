package com.beauty4you.admin.ui.article

import org.junit.Assert.assertEquals
import org.junit.Test

// item89: что делает приложение с ссылками в статье
class ArticleLinksTest {

    private fun classify(url: String?) = ArticleLinks.classify(url)

    @Test
    fun `anchor links scroll inside the article`() {
        assertEquals(ArticleLink.InPage, classify("#shade-3"))
        // WebView отдаёт относительную ссылку, склеенную с about:blank
        assertEquals(ArticleLink.InPage, classify("about:blank#shade-12"))
        assertEquals(ArticleLink.InPage, classify("about:blank#"))
    }

    @Test
    fun `book anchor opens the booking screen`() {
        assertEquals(ArticleLink.Book, classify("#book"))
        assertEquals(ArticleLink.Book, classify("about:blank#book"))
        assertEquals(ArticleLink.Book, classify("  about:blank#book "))
    }

    @Test
    fun `anchors resolved against the data url of the page are recognised`() {
        assertEquals(ArticleLink.Book, classify("data:text/html;charset=utf-8;base64,PGh0bWw+#book"))
        assertEquals(ArticleLink.InPage, classify("data:text/html;charset=utf-8;base64,PGh0bWw+#shade-2"))
        assertEquals(ArticleLink.Blocked, classify("data:text/html;charset=utf-8;base64,PGh0bWw+"))
    }

    @Test
    fun `anchors that only look like book stay in the page`() {
        assertEquals(ArticleLink.InPage, classify("#booking"))
        assertEquals(ArticleLink.InPage, classify("#Book"))
        assertEquals(ArticleLink.InPage, classify("about:blank#book-now"))
    }

    @Test
    fun `https opens in the external browser`() {
        assertEquals(ArticleLink.External("https://asamazam.com/fall-2026-nail-colors/"), classify("https://asamazam.com/fall-2026-nail-colors/"))
        assertEquals(ArticleLink.External("HTTPS://EXAMPLE.COM"), classify("HTTPS://EXAMPLE.COM"))
        assertEquals(ArticleLink.External("https://example.com/a?b=1#c"), classify("https://example.com/a?b=1#c"))
    }

    @Test
    fun `everything else is blocked`() {
        listOf(
            "http://example.com",
            "tel:+48123456789",
            "mailto:a@b.pl",
            "javascript:alert(1)",
            "intent://scan/#Intent;scheme=zxing;end",
            "file:///sdcard/x.html",
            "content://media/external/1",
            "data:text/html;base64,AAAA",
            "about:blank",
            "https://",
            "https:///path",
            "//example.com",
            "/relative/path",
            "market://details?id=x",
            "",
            "   ",
        ).forEach { assertEquals("should be blocked: '$it'", ArticleLink.Blocked, classify(it)) }
        assertEquals(ArticleLink.Blocked, classify(null))
    }
}
