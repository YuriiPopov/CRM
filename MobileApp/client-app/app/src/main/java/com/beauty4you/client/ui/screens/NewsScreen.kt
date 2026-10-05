package com.beauty4you.client.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.data.NewsItem
import com.beauty4you.client.data.NewsState
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.B4UCard
import com.beauty4you.client.ui.common.EmojiTile
import com.beauty4you.client.ui.common.EmptyState
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.ScreenTitle
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.formatDate
import com.beauty4you.client.ui.errorMessage
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.MutedLight

// Aktualności: опубликованные новости салона из GET /client/news (item75), новые сверху
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsScreen(vm: ClientViewModel) {
    val news by vm.news.collectAsStateWithLifecycle()
    val refreshing by vm.newsRefreshing.collectAsStateWithLifecycle()

    PullToRefreshBox(isRefreshing = refreshing, onRefresh = vm::refreshNews, modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 40.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(Modifier.padding(bottom = 4.dp)) {
                    ScreenTitle(stringResource(R.string.tab_news))
                    VSpace(4.dp)
                    Text(stringResource(R.string.news_subtitle), style = B4UType.BodyMuted.copy(lineHeight = 17.sp), color = Muted)
                }
            }
            when (val state = news) {
                NewsState.Loading -> item {
                    Box(Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Accent)
                    }
                }
                // Ошибка новостей — только здесь; остальные вкладки работают (item75-fix)
                is NewsState.Failed -> item {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                        EmptyState(stringResource(R.string.news_error_title), stringResource(errorMessage(state.error)))
                        VSpace(16.dp)
                        AccentButton(stringResource(R.string.retry), onClick = vm::refreshNews, large = true)
                    }
                }
                is NewsState.Ready -> if (state.items.isEmpty()) {
                    item { EmptyState(stringResource(R.string.news_empty_title), stringResource(R.string.news_empty_text), Modifier.padding(top = 12.dp)) }
                } else {
                    newsItems(state.items)
                }
            }
        }
    }
}

private fun LazyListScope.newsItems(news: List<NewsItem>) {
    items(news, key = { it.id }) { n ->
        B4UCard(shape = RoundedCornerShape(16.dp), contentPadding = PaddingValues(0.dp)) {
            val image = n.image
            if (image != null) {
                Image(image, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(130.dp))
            } else {
                EmojiTile(n.tag.emoji, Modifier.fillMaxWidth().height(130.dp), fontSize = 26, shape = RectangleShape)
            }
            Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                Text(
                    n.tag.label.uppercase(),
                    style = B4UType.Pill.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp),
                    color = n.tag.color,
                )
                VSpace(4.dp)
                Text(n.title, style = B4UType.RowTitle.copy(fontWeight = FontWeight.Bold), color = InkStrong)
                VSpace(3.dp)
                Text(n.text, style = B4UType.Caption.copy(lineHeight = 17.sp), color = Muted)
                VSpace(7.dp)
                Text(formatDate(n.date), style = B4UType.SmallLabel.copy(fontWeight = FontWeight.Normal), color = MutedLight)
            }
        }
    }
}
