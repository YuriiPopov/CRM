package com.beauty4you.client.ui.screens

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.Pushed
import com.beauty4you.client.ui.article.ArticleLink
import com.beauty4you.client.ui.article.ArticleState
import com.beauty4you.client.ui.article.ArticleWebView
import com.beauty4you.client.ui.articleErrorMessage
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.EmptyState
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.AppBackground
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.Ink

/**
 * Страница статьи новости (item89): верхняя панель со стрелкой «назад» и WebView со статьёй.
 * Системная «назад» (BackHandler в ClientApp) возвращает в ленту на то же место.
 */
@Composable
fun NewsArticleScreen(vm: ClientViewModel, pushed: Pushed.NewsArticle) {
    val state by vm.article.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Column(Modifier.fillMaxSize().background(AppBackground)) {
        Column(Modifier.background(CardBg)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val backLabel = stringResource(R.string.back)
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = vm::back)
                        .semantics { contentDescription = backLabel }
                        .testTag("article_back"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("←", fontSize = 22.sp, color = Ink)
                }
                Text(
                    pushed.title,
                    style = B4UType.PushedTitle,
                    color = Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(end = 8.dp),
                )
            }
            HorizontalDivider(color = Border)
        }

        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (val current = state) {
                ArticleState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Accent)
                }
                is ArticleState.Failed -> CenteredMessage {
                    EmptyState(stringResource(R.string.news_article_error_title), stringResource(articleErrorMessage(current.error)))
                    Column(Modifier.padding(top = 16.dp)) {
                        AccentButton(stringResource(R.string.retry), onClick = vm::retryArticle, large = true)
                    }
                }
                ArticleState.Empty -> CenteredMessage {
                    EmptyState(stringResource(R.string.news_article_empty_title), stringResource(R.string.news_article_empty_text))
                }
                is ArticleState.Ready -> {
                    // Платформенная ошибка WebView (процесс отрисовки упал) — экран ошибки с повтором
                    var failed by remember(current.html) { mutableStateOf(false) }
                    if (failed) {
                        CenteredMessage {
                            EmptyState(stringResource(R.string.news_article_error_title), stringResource(R.string.error_generic))
                            Column(Modifier.padding(top = 16.dp)) {
                                AccentButton(stringResource(R.string.retry), onClick = vm::retryArticle, large = true)
                            }
                        }
                    } else {
                        ArticleWebView(
                            html = current.html,
                            darkTheme = isSystemInDarkTheme(),
                            onLink = { link -> handleLink(context, vm, link) },
                            onFailure = { failed = true },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CenteredMessage(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(PagePadding),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { content() }
}

/** `#book` → экран записи; `https:` → внешний браузер; остальное WebView уже отфильтровал. */
private fun handleLink(context: Context, vm: ClientViewModel, link: ArticleLink) {
    when (link) {
        ArticleLink.Book -> vm.startBooking()
        is ArticleLink.External -> openInBrowser(context, link.url)
        ArticleLink.InPage, ArticleLink.Blocked -> Unit
    }
}

private fun openInBrowser(context: Context, url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)
    try {
        context.startActivity(intent)
    } catch (_: ActivityNotFoundException) {
        // Нет браузера — ссылка просто не открывается
    }
}
