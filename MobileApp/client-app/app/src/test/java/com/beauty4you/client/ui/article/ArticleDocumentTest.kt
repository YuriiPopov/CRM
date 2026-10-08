package com.beauty4you.client.ui.article

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArticleDocumentTest {

    private val doc = ArticleDocument.wrap("<article>Treść</article>")

    @Test
    fun `fits the screen width and forbids scaling`() {
        assertTrue(doc.contains("width=device-width"))
        assertTrue(doc.contains("user-scalable=no"))
    }

    @Test
    fun `lets the article choose its theme via prefers-color-scheme`() {
        assertTrue(doc.contains("<meta name=\"color-scheme\" content=\"light dark\">"))
    }

    @Test
    fun `csp allows only inline styles and data images`() {
        assertTrue(doc.contains("default-src 'none'"))
        assertTrue(doc.contains("img-src data:"))
        assertFalse(doc.contains("script-src"))
    }

    @Test
    fun `puts the fragment in the body unchanged`() {
        assertTrue(doc.contains("<body><article>Treść</article></body>"))
        assertEquals(1, Regex("<body>").findAll(doc).count())
    }
}
