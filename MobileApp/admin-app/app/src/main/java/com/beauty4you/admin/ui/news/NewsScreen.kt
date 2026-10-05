package com.beauty4you.admin.ui.news

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.NewsCategory
import com.beauty4you.admin.domain.NewsFormLogic
import com.beauty4you.admin.domain.NewsPost
import com.beauty4you.admin.domain.NewsStatus
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.ui.common.B4UCard
import com.beauty4you.admin.ui.common.DashedEmptyState
import com.beauty4you.admin.ui.common.DataUrlImage
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.RefreshOnResume
import com.beauty4you.admin.ui.common.ScreenHeader
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.PillShape
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.StatusColors
import com.beauty4you.admin.ui.theme.StatusConfirmed
import com.beauty4you.admin.ui.theme.StatusPending
import com.beauty4you.admin.ui.theme.Tint
import java.time.LocalDate
import java.time.ZoneId

// Aktualności (item75) — список новостей салона по дизайну «B4U Admin App» (NEWS (ADMIN CMS))
@Composable
fun NewsScreen(onBack: () -> Unit) {
    val viewModel: NewsViewModel = viewModel(factory = NewsViewModel.factory(appContainer()))
    val state by viewModel.state.collectAsState()
    RefreshOnResume { viewModel.load() }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(Modifier.padding(bottom = 4.dp)) {
                    ScreenHeader(title = stringResource(R.string.more_news), onBack = onBack)
                    Text(
                        stringResource(R.string.news_subtitle),
                        style = B4UType.Caption.copy(fontSize = 12.5.sp, lineHeight = 17.sp),
                        color = Muted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            when {
                state.loading -> item { SkeletonList(rows = 3, height = 220.dp) }
                state.error -> item { ErrorState(onRetry = viewModel::load) }
                state.posts.isEmpty() -> item {
                    DashedEmptyState(
                        title = stringResource(R.string.news_empty_title),
                        text = stringResource(R.string.news_empty_text),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                else -> items(state.posts, key = { it.id }) { post ->
                    NewsCard(post, onClick = { viewModel.openEdit(post) })
                }
            }
        }

        FloatingActionButton(
            onClick = viewModel::openCreate,
            shape = CircleShape,
            containerColor = Rose,
            contentColor = Color.White,
            elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp),
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 24.dp, bottom = 20.dp).size(52.dp),
        ) {
            Icon(Icons.Filled.Add, contentDescription = stringResource(R.string.news_add))
        }
    }

    state.editor?.let { editor -> NewsFormSheet(editor, viewModel) }
}

@Composable
private fun NewsCard(post: NewsPost, onClick: () -> Unit) {
    B4UCard(onClick = onClick) {
        Column {
            NewsImageBox(post.imageUrl, Modifier.fillMaxWidth().height(130.dp))
            Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        stringResource(post.category.labelRes()).uppercase(),
                        style = B4UType.Pill.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp),
                        color = post.category.color(),
                        modifier = Modifier.weight(1f),
                    )
                    NewsStatusPill(post.status)
                }
                Text(
                    post.title,
                    style = B4UType.ItemTitleBold.copy(fontSize = 14.sp),
                    color = InkStrong,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(
                    post.body,
                    style = B4UType.Caption.copy(lineHeight = 17.sp),
                    color = Muted,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 3.dp),
                )
                Text(
                    PolishDates.dayMonth(NewsFormLogic.displayDate(post, ZoneId.systemDefault()), LocalDate.now()),
                    style = B4UType.Tiny,
                    color = MutedLight,
                    modifier = Modifier.padding(top = 7.dp),
                )
            }
        }
    }
}

// Слот картинки из дизайна (image-slot 130 px); без картинки — светлая плашка с иконкой
@Composable
internal fun NewsImageBox(dataUrl: String?, modifier: Modifier = Modifier) {
    DataUrlImage(
        dataUrl = dataUrl,
        modifier = modifier.background(Tint),
        placeholder = { Icon(Icons.Filled.Image, contentDescription = null, tint = MutedLight, modifier = Modifier.size(28.dp)) },
    )
}

@Composable
private fun NewsStatusPill(status: NewsStatus) {
    val colors = status.colors()
    Text(
        stringResource(status.labelRes()),
        style = B4UType.Pill.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold),
        color = colors.fg,
        maxLines = 1,
        modifier = Modifier.clip(PillShape).background(colors.bg).padding(horizontal = 9.dp, vertical = 3.dp),
    )
}

// Подписи и цвета категорий — NEWS_TAGS из дизайна
@StringRes
internal fun NewsCategory.labelRes(): Int = when (this) {
    NewsCategory.NOWOSC -> R.string.news_category_nowosc
    NewsCategory.DIGEST -> R.string.news_category_digest
    NewsCategory.INSPIRACJA -> R.string.news_category_inspiracja
}

internal fun NewsCategory.color(): Color = when (this) {
    NewsCategory.NOWOSC -> Color(0xFF4F8A82)
    NewsCategory.DIGEST -> Color(0xFF6E7FC9)
    NewsCategory.INSPIRACJA -> Color(0xFFA85B93)
}

// NEWS_STATUS из дизайна — те же цвета, что у «Potwierdzona» / «Oczekująca»
@StringRes
internal fun NewsStatus.labelRes(): Int = when (this) {
    NewsStatus.PUBLISHED -> R.string.news_status_published
    NewsStatus.DRAFT -> R.string.news_status_draft
}

internal fun NewsStatus.colors(): StatusColors = when (this) {
    NewsStatus.PUBLISHED -> StatusConfirmed
    NewsStatus.DRAFT -> StatusPending
}
