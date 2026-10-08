package com.beauty4you.client.ui.article

/**
 * Оборачивает HTML-фрагмент статьи (его уже очистил backend) в полноценный документ для WebView:
 * ширина по экрану без масштабирования, светлая/тёмная схема берётся из `prefers-color-scheme` самой
 * статьи, а CSP вторым рубежом запрещает всё, кроме встроенных картинок и стилей (скрипты и сеть
 * выключены ещё и настройками WebView).
 */
object ArticleDocument {
    const val CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"

    fun wrap(fragment: String): String = buildString(fragment.length + 700) {
        append("<!DOCTYPE html><html><head><meta charset=\"utf-8\">")
        append("<meta http-equiv=\"Content-Security-Policy\" content=\"").append(CSP).append("\">")
        append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no\">")
        append("<meta name=\"color-scheme\" content=\"light dark\">")
        append("<style>html,body{margin:0;padding:0;background:Canvas;color:CanvasText}</style>")
        append("</head><body>")
        append(fragment)
        append("</body></html>")
    }
}
