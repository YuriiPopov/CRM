package com.beauty4you.admin.ui.more

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.Formatters
import com.beauty4you.admin.ui.common.B4UCard
import com.beauty4you.admin.ui.common.ColorDot
import com.beauty4you.admin.ui.common.DashedEmptyState
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.MasterPhoto
import com.beauty4you.admin.ui.common.RefreshOnResume
import com.beauty4you.admin.ui.common.ScreenHeader
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.StatusCancelled
import com.beauty4you.admin.ui.theme.Tint
import com.beauty4you.admin.ui.theme.masterColor

@Composable
private fun moreViewModel(): MoreViewModel = viewModel(factory = MoreViewModel.factory(appContainer()))

@Composable
fun MoreScreen(onOpenMasters: () -> Unit, onOpenServices: () -> Unit, onOpenNews: () -> Unit) {
    val viewModel = moreViewModel()
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) { viewModel.load() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { ScreenHeader(title = stringResource(R.string.more_title), modifier = Modifier.padding(bottom = 6.dp)) }
        item { MenuRow(Icons.Filled.Groups, R.string.more_masters, R.string.more_masters_sub, onOpenMasters) }
        item { MenuRow(Icons.Filled.ContentCut, R.string.more_services, R.string.more_services_sub, onOpenServices) }
        item { MenuRow(Icons.Filled.Newspaper, R.string.more_news, R.string.more_news_sub, onOpenNews) }
        item {
            B4UCard(modifier = Modifier.padding(top = 14.dp), onClick = viewModel::logout) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = StatusCancelled.fg)
                    Column(Modifier.padding(start = 12.dp)) {
                        Text(stringResource(R.string.more_logout), style = B4UType.ItemTitle.copy(fontSize = 14.sp), color = StatusCancelled.fg)
                        state.email?.let { Text(stringResource(R.string.more_logged_as, it), style = B4UType.Caption, color = Muted) }
                    }
                }
            }
        }
    }
}

@Composable
private fun MenuRow(icon: ImageVector, title: Int, subtitle: Int, onClick: () -> Unit) {
    B4UCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            Box(
                Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(Tint),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = Rose, modifier = Modifier.size(20.dp))
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(stringResource(title), style = B4UType.ItemTitle.copy(fontSize = 14.sp), color = InkStrong)
                Text(stringResource(subtitle), style = B4UType.Caption, color = Muted, modifier = Modifier.padding(top = 1.dp))
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = MutedLight)
        }
    }
}

@Composable
fun MastersScreen(onBack: () -> Unit) {
    val viewModel = moreViewModel()
    val state by viewModel.state.collectAsState()
    RefreshOnResume { viewModel.load(force = true) }
    val catalog = state.catalog

    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        item { ScreenHeader(title = stringResource(R.string.more_masters), onBack = onBack, modifier = Modifier.padding(bottom = 6.dp)) }
        when {
            state.loading -> item { SkeletonList(rows = 4) }
            state.error || catalog == null -> item { ErrorState(onRetry = { viewModel.load(force = true) }) }
            // Активные сверху, неактивные — в конце с пометкой (веб-CRM тоже показывает всех)
            else -> items(catalog.masters.sortedBy { !it.isActive }, key = { it.id }) { master ->
                val specialty = master.categoryIds.mapNotNull { catalog.categoriesById[it]?.name }.joinToString(", ")
                B4UCard {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                        MasterPhoto(master.photo, size = 44.dp)
                        Column(Modifier.weight(1f).padding(start = 12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                ColorDot(masterColor(master.id))
                                Text(master.name, style = B4UType.ItemTitleBold, color = InkStrong, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                if (!master.isActive) {
                                    Text(stringResource(R.string.masters_inactive), style = B4UType.Pill, color = Muted)
                                }
                            }
                            Text(
                                specialty.ifBlank { stringResource(R.string.masters_no_specialty) },
                                style = B4UType.Caption,
                                color = Muted,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text((state.todayByMaster[master.id] ?: 0).toString(), style = B4UType.BodyStrong.copy(fontSize = 12.sp), color = Ink)
                            Text(stringResource(R.string.masters_today), style = B4UType.Tiny.copy(fontSize = 10.sp), color = Muted)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ServicesScreen(onBack: () -> Unit) {
    val viewModel = moreViewModel()
    val state by viewModel.state.collectAsState()
    RefreshOnResume { viewModel.load(force = true) }
    val catalog = state.catalog
    val otherLabel = stringResource(R.string.services_other)

    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item { ScreenHeader(title = stringResource(R.string.more_services), onBack = onBack, modifier = Modifier.padding(bottom = 6.dp)) }
        when {
            state.loading -> item { SkeletonList(rows = 5) }
            state.error || catalog == null -> item { ErrorState(onRetry = { viewModel.load(force = true) }) }
            else -> {
                val groups = catalog.services
                    .groupBy { catalog.categoriesById[it.categoryId]?.name ?: otherLabel }
                    .toSortedMap(compareBy { it.lowercase() })
                groups.forEach { (category, services) ->
                    item(key = "cat-$category") {
                        Text(
                            category.uppercase(),
                            style = B4UType.BodyStrong.copy(fontSize = 13.sp, letterSpacing = 0.4.sp),
                            color = Muted,
                            modifier = Modifier.padding(top = 12.dp, bottom = 2.dp),
                        )
                    }
                    items(services, key = { it.id }) { service ->
                        B4UCard {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp)) {
                                Column(Modifier.weight(1f)) {
                                    Text(service.name, style = B4UType.ItemTitle, color = InkStrong)
                                    Text(stringResource(R.string.services_duration, service.durationMin), style = B4UType.CaptionSmall, color = Muted)
                                }
                                Text(Formatters.price(service.price), style = B4UType.ItemTitleBold, color = Ink)
                            }
                        }
                    }
                }
            }
        }
    }
}

// Aktualności: backend новостей нет — этап 2 (см. ТЗ item73)
@Composable
fun NewsStubScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().statusBarsPadding().padding(start = 18.dp, end = 18.dp, top = 12.dp)) {
        ScreenHeader(title = stringResource(R.string.more_news), onBack = onBack)
        DashedEmptyState(
            title = stringResource(R.string.news_stub_title),
            text = stringResource(R.string.news_stub_text),
            modifier = Modifier.padding(top = 16.dp),
        )
    }
}
