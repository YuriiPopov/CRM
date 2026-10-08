package com.beauty4you.admin.ui.article

import android.annotation.SuppressLint
import android.graphics.Color
import android.view.MotionEvent
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

/**
 * WebView страницы статьи (item89). Копия WebView из client-app (общего модуля у приложений нет) —
 * предпросмотр в admin-app показывает статью тем же кодом, что и клиентское приложение. Менять синхронно.
 *
 * Безопасность: JavaScript выключен; доступ к сети, файлам и content:// выключен; контент —
 * loadDataWithBaseURL(null, …). Ширина по экрану, масштабирование выключено, вертикальная прокрутка
 * обычная. Тёмная тема — из `prefers-color-scheme` в HTML статьи, алгоритмическое затемнение выключено.
 * Ссылки не открываются в самом WebView: [onLink] решает, что с ними делать ([ArticleLinks.classify]).
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ArticleWebView(
    html: String,
    darkTheme: Boolean,
    onLink: (ArticleLink) -> Unit,
    onFailure: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val currentOnLink by rememberUpdatedState(onLink)
    val currentOnFailure by rememberUpdatedState(onFailure)

    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                setBackgroundColor(Color.TRANSPARENT)
                isVerticalScrollBarEnabled = true
                isHorizontalScrollBarEnabled = false
                applySecureSettings(settings)
                // Переход по #якорю внутри страницы WebView делает сам, не вызывая shouldOverrideUrlLoading,
                // поэтому «#book» (кнопка записи) ловим по нажатию на ссылку
                setOnTouchListener { v, event ->
                    if (event.actionMasked == MotionEvent.ACTION_UP) {
                        val hit = (v as WebView).hitTestResult
                        val isAnchor = hit.type == WebView.HitTestResult.SRC_ANCHOR_TYPE ||
                            hit.type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE
                        if (isAnchor && ArticleLinks.classify(hit.extra) == ArticleLink.Book) currentOnLink(ArticleLink.Book)
                    }
                    false
                }
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        // Подфреймов в статье нет (iframe вырезан backend'ом) — любой такой запрос блокируем
                        if (!request.isForMainFrame) return true
                        return when (val link = ArticleLinks.classify(request.url.toString())) {
                            // Якорь внутри статьи: WebView сам прокрутит к элементу
                            ArticleLink.InPage -> false
                            else -> {
                                currentOnLink(link)
                                true
                            }
                        }
                    }

                    // Второй рубеж к blockNetworkLoads/CSP: наружу не уходит ни один запрос
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                        if (request.url.scheme == "data" || request.url.toString().startsWith("about:")) null
                        else WebResourceResponse("text/plain", "utf-8", null)

                    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                        currentOnFailure()
                        return true
                    }
                }
            }
        },
        update = { view ->
            applyDarkTheme(view.settings, darkTheme)
            // Перезагружаем только при смене самого HTML, а не при каждой рекомпозиции (иначе прокрутка сбросится)
            if (view.tag != html) {
                view.tag = html
                view.loadDataWithBaseURL(null, ArticleDocument.wrap(html), "text/html", "UTF-8", null)
            }
        },
        onRelease = { view ->
            view.stopLoading()
            view.destroy()
        },
    )
}

@Suppress("DEPRECATION")
private fun applySecureSettings(settings: WebSettings) = settings.run {
    javaScriptEnabled = false
    domStorageEnabled = false
    databaseEnabled = false
    allowFileAccess = false
    allowContentAccess = false
    allowFileAccessFromFileURLs = false
    allowUniversalAccessFromFileURLs = false
    blockNetworkLoads = true
    blockNetworkImage = false // картинки встроены как data: — сетью не считаются
    cacheMode = WebSettings.LOAD_NO_CACHE
    setGeolocationEnabled(false)
    setSupportMultipleWindows(false)
    javaScriptCanOpenWindowsAutomatically = false
    // Ширина по экрану (viewport из документа), масштабирование жестами и кнопками выключено
    useWideViewPort = true
    loadWithOverviewMode = true
    setSupportZoom(false)
    builtInZoomControls = false
    displayZoomControls = false
}

/**
 * Тёмную тему определяет сама статья через `@media (prefers-color-scheme: dark)`. WebView нужно лишь
 * сообщить схему системы и запретить собственное «алгоритмическое» затемнение поверх (оно портит
 * заданные статьёй цвета и фото).
 */
@Suppress("DEPRECATION")
private fun applyDarkTheme(settings: WebSettings, dark: Boolean) {
    if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
        WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
    }
    if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
        WebSettingsCompat.setForceDark(
            settings,
            if (dark) WebSettingsCompat.FORCE_DARK_ON else WebSettingsCompat.FORCE_DARK_OFF,
        )
        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) {
            WebSettingsCompat.setForceDarkStrategy(settings, WebSettingsCompat.DARK_STRATEGY_WEB_THEME_DARKENING_ONLY)
        }
    }
}
