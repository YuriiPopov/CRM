package com.beauty4you.admin.ui.dashboard

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.DayMarkers
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.ui.common.B4UCard
import com.beauty4you.admin.ui.common.BookingItem
import com.beauty4you.admin.ui.common.ColorDot
import com.beauty4you.admin.ui.common.DashedEmptyState
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.MasterPhoto
import com.beauty4you.admin.ui.common.RefreshOnResume
import com.beauty4you.admin.ui.common.SectionTitle
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.StatusPill
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.BorderSoft
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.CardShape
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.StatusPending
import com.beauty4you.admin.ui.theme.Tint
import com.beauty4you.admin.ui.theme.masterColor
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onOpenBooking: (Booking) -> Unit,
    onOpenPending: (LocalDate?) -> Unit,
) {
    val viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.factory(appContainer()))
    val state by viewModel.state.collectAsState()
    RefreshOnResume { viewModel.load(silent = state.todayItems.isNotEmpty() || state.upcomingItems.isNotEmpty(), force = true) }

    PullToRefreshBox(
        isRefreshing = false,
        onRefresh = { viewModel.load(force = true) },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 24.dp),
        ) {
            item { Header(state.greetingName, state.today) }

            if (state.pendingCount > 0) {
                item { PendingBanner(state.pendingCount) { onOpenPending(state.earliestPendingDate) } }
            }

            item { SectionTitle(stringResource(R.string.dashboard_today), Modifier.padding(top = 26.dp, bottom = 10.dp)) }
            when {
                state.loading -> item { SkeletonList(rows = 3, height = 56.dp) }
                state.error -> item { ErrorState(onRetry = { viewModel.load(force = true) }) }
                state.todayItems.isEmpty() -> item {
                    DashedEmptyState(
                        title = stringResource(R.string.dashboard_today_empty_title),
                        text = stringResource(R.string.dashboard_today_empty_text),
                    )
                }
                else -> item { TodayList(state.todayItems, onOpenBooking) }
            }

            if (!state.loading && !state.error) {
                item { SectionTitle(stringResource(R.string.dashboard_upcoming), Modifier.padding(top = 26.dp, bottom = 10.dp)) }
                if (state.upcomingItems.isEmpty()) {
                    item { Text(stringResource(R.string.dashboard_upcoming_empty), style = B4UType.Caption, color = Muted) }
                }
                state.upcomingItems.forEach { item ->
                    item(key = "up-${item.booking.id}") {
                        UpcomingCard(item, state.today) { onOpenBooking(item.booking) }
                    }
                }

                item { SectionTitle(stringResource(R.string.dashboard_week), Modifier.padding(top = 26.dp, bottom = 12.dp)) }
                item { WeekStrip(state.week, state.today) }
                item { WeekLegend(state) }
            }
        }
    }
}

@Composable
private fun Header(name: String, today: LocalDate) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.weight(1f)) {
            Text(stringResource(R.string.dashboard_greeting, name), style = B4UType.ScreenTitle, color = Ink)
            Text(PolishDates.longDate(today), style = B4UType.ScreenSubtitleSerif, color = Muted, modifier = Modifier.padding(top = 2.dp))
        }
        Box(
            modifier = Modifier
                .size(60.dp)
                .shadow(6.dp, RoundedCornerShape(16.dp))
                .background(CardBg, RoundedCornerShape(16.dp))
                .border(1.dp, Border, RoundedCornerShape(16.dp))
                .padding(4.dp),
        ) {
            Image(
                painter = painterResource(R.drawable.b4u_logo),
                contentDescription = null,
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
        }
    }
}

@Composable
private fun PendingBanner(count: Int, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .padding(top = 18.dp)
            .fillMaxWidth()
            .clip(CardShape)
            .background(StatusPending.bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(30.dp).clip(CircleShape).background(StatusPending.fg),
            contentAlignment = Alignment.Center,
        ) {
            Text(count.toString(), style = B4UType.BodyStrong, color = CardBg)
        }
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            Text(stringResource(R.string.dashboard_pending), style = B4UType.ItemTitle, color = InkStrong)
            Text(stringResource(R.string.dashboard_pending_hint), style = B4UType.CaptionSmall, color = Muted)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = StatusPending.fg)
    }
}

@Composable
private fun TodayList(items: List<BookingItem>, onOpenBooking: (Booking) -> Unit) {
    B4UCard {
        Column {
            items.forEachIndexed { index, item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenBooking(item.booking) }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        PolishDates.time(item.booking.start.toLocalTime()),
                        style = B4UType.BodyStrong,
                        color = Ink,
                        modifier = Modifier.width(46.dp),
                    )
                    Box(
                        Modifier
                            .width(4.dp)
                            .height(34.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(masterColor(item.booking.masterId)),
                    )
                    Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(item.serviceName, style = B4UType.ItemTitle, color = InkStrong, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            "${item.clientName} · ${item.masterName}",
                            style = B4UType.Caption,
                            color = Muted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    StatusPill(item.booking.status)
                }
                if (index < items.lastIndex) HorizontalDivider(color = BorderSoft)
            }
        }
    }
}

@Composable
private fun UpcomingCard(item: BookingItem, today: LocalDate, onClick: () -> Unit) {
    B4UCard(modifier = Modifier.padding(bottom = 8.dp), onClick = onClick) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            MasterPhoto(item.masterPhoto, size = 34.dp)
            ColorDot(masterColor(item.booking.masterId))
            Column(modifier = Modifier.weight(1f)) {
                Text(item.serviceName, style = B4UType.ItemTitle, color = InkStrong, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    "${PolishDates.relativeDay(item.booking.date, today)}, ${PolishDates.time(item.booking.start.toLocalTime())} · ${item.masterName} · ${item.clientName}",
                    style = B4UType.CaptionSmall,
                    color = Muted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            StatusPill(item.booking.status)
        }
    }
}

@Composable
private fun WeekStrip(week: List<DayMarkers>, today: LocalDate) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        week.forEach { day ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (day.date == today) Tint else androidx.compose.ui.graphics.Color.Transparent)
                    .padding(vertical = 8.dp, horizontal = 2.dp),
            ) {
                Text(PolishDates.weekdayShort(day.date), style = B4UType.Pill, color = Muted)
                Text(day.date.dayOfMonth.toString(), style = B4UType.BodyStrong, color = Ink, modifier = Modifier.padding(top = 6.dp))
                // Фиксированная высота и метки от верхнего края: первая метка у всех дней на одной линии,
                // а ячейки не «прыгают» по высоте (до 5 меток + «+N», см. DashboardLogic.weekMarkers)
                Column(
                    verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.Top),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(top = 6.dp).height(46.dp),
                ) {
                    day.masterIds.forEach { masterId ->
                        Box(
                            Modifier
                                .size(width = 16.dp, height = 4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(masterColor(masterId)),
                        )
                    }
                    if (day.overflow > 0) {
                        Text(stringResource(R.string.dashboard_more_markers, day.overflow), style = B4UType.Pill, color = MutedLight)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WeekLegend(state: DashboardUiState) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.padding(top = 12.dp),
    ) {
        state.weekMasters.forEach { master ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                ColorDot(masterColor(master.id), size = 7.dp)
                Text(master.name, style = B4UType.Tiny, color = Muted)
            }
        }
    }
}
