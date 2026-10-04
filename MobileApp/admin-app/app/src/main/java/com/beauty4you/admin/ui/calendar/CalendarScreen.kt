package com.beauty4you.admin.ui.calendar

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.domain.CalendarLogic
import com.beauty4you.admin.domain.MasterGroup
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.ui.common.BookingCard
import com.beauty4you.admin.ui.common.ColorDot
import com.beauty4you.admin.ui.common.DashedEmptyState
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.MasterPhoto
import com.beauty4you.admin.ui.common.RefreshOnResume
import com.beauty4you.admin.ui.common.ScreenHeader
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.common.labelRes
import com.beauty4you.admin.ui.common.toItem
import com.beauty4you.admin.ui.theme.Accent
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.PillShape
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.Tint
import com.beauty4you.admin.ui.theme.masterColor
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    onOpenBooking: (Booking) -> Unit,
    onCreateBooking: (LocalDate) -> Unit,
) {
    val container = appContainer()
    val viewModel: CalendarViewModel = viewModel(factory = CalendarViewModel.factory(container))
    val state by viewModel.state.collectAsState()
    val calendarRequest by container.events.calendarRequest.collectAsState()

    LaunchedEffect(calendarRequest) {
        container.events.consumeCalendarRequest()?.let(viewModel::apply)
    }
    RefreshOnResume { viewModel.load(silent = state.catalog != null, force = true) }

    Box(modifier = Modifier.fillMaxSize()) {
        PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = { viewModel.load(force = true, pullToRefresh = true) },
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize().statusBarsPadding(),
                contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 96.dp),
            ) {
                item {
                    ScreenHeader(
                        title = stringResource(R.string.calendar_title),
                        subtitle = stringResource(
                            when (state.view) {
                                CalendarView.LIST -> R.string.calendar_subtitle_list
                                CalendarView.MASTERS -> R.string.calendar_subtitle_masters
                                CalendarView.TIMELINE -> R.string.calendar_subtitle_timeline
                            },
                        ),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(CardBg)
                                .border(1.dp, Border, RoundedCornerShape(10.dp))
                                .clickable { viewModel.load(force = true, pullToRefresh = true) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Filled.Refresh, contentDescription = stringResource(R.string.calendar_refresh), tint = Rose, modifier = Modifier.size(18.dp))
                        }
                    }
                }
                item { ViewSwitcher(state.view, viewModel::setView) }
                item { WeekNavigator(state, viewModel) }
                item { WeekStrip(state, viewModel::selectDate) }
                item { Filters(state, viewModel) }

                item { Box(Modifier.padding(top = 16.dp)) }
                val catalog = state.catalog
                when {
                    state.loading -> item { SkeletonList() }
                    state.error || catalog == null -> item { ErrorState(onRetry = { viewModel.load(force = true) }) }
                    state.view == CalendarView.TIMELINE -> item { TimelineContent(state, catalog, onOpenBooking) }
                    state.dayBookings.isEmpty() -> item {
                        DashedEmptyState(
                            title = stringResource(R.string.calendar_empty_title),
                            text = stringResource(R.string.calendar_empty_text),
                        )
                    }
                    state.view == CalendarView.LIST -> items(state.dayBookings, key = { it.id }) { booking ->
                        BookingCard(
                            item = catalog.toItem(booking),
                            today = state.today,
                            onClick = { onOpenBooking(booking) },
                            modifier = Modifier.padding(bottom = 9.dp),
                        )
                    }
                    else -> CalendarLogic.groupByMaster(state.dayBookings, catalog.masters).forEach { group ->
                        item(key = "group-${group.master.id}") { GroupHeader(group) }
                        items(group.bookings, key = { "g-${it.id}" }) { booking ->
                            BookingCard(
                                item = catalog.toItem(booking),
                                today = state.today,
                                onClick = { onOpenBooking(booking) },
                                subtitle = catalog.clientName(booking.clientId),
                                showAccent = false,
                                modifier = Modifier.padding(bottom = 8.dp),
                            )
                        }
                    }
                }
            }
        }

        FloatingActionButton(
            onClick = { onCreateBooking(state.selectedDate) },
            containerColor = Rose,
            contentColor = Color.White,
            shape = CircleShape,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 22.dp, bottom = 20.dp)
                .size(52.dp),
        ) {
            Icon(Icons.Filled.Add, contentDescription = stringResource(R.string.calendar_add))
        }
    }
}

@Composable
private fun ViewSwitcher(current: CalendarView, onSelect: (CalendarView) -> Unit) {
    Row(
        modifier = Modifier
            .padding(top = 16.dp)
            .fillMaxWidth()
            .clip(FieldShape)
            .background(Tint)
            .padding(3.dp),
    ) {
        listOf(
            CalendarView.LIST to R.string.calendar_view_list,
            CalendarView.MASTERS to R.string.calendar_view_masters,
            CalendarView.TIMELINE to R.string.calendar_view_timeline,
        ).forEach { (view, label) ->
            val selected = view == current
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(9.dp))
                    .background(if (selected) CardBg else Color.Transparent)
                    .clickable { onSelect(view) }
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(stringResource(label), style = B4UType.ItemTitle.copy(fontSize = 13.sp), color = if (selected) Ink else Muted)
            }
        }
    }
}

@Composable
private fun WeekNavigator(state: CalendarUiState, viewModel: CalendarViewModel) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp).fillMaxWidth()) {
        IconButton(onClick = { viewModel.shiftWeek(-1) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = stringResource(R.string.calendar_prev_week), tint = Muted)
        }
        Text(
            PolishDates.weekRange(state.weekStart),
            style = B4UType.BodyStrong,
            color = Ink,
            modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        if (state.selectedDate != state.today) {
            Text(
                stringResource(R.string.calendar_today),
                style = B4UType.Label,
                color = Rose,
                modifier = Modifier.clip(PillShape).clickable { viewModel.goToday() }.padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        IconButton(onClick = { viewModel.shiftWeek(1) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = stringResource(R.string.calendar_next_week), tint = Muted)
        }
    }
}

@Composable
private fun WeekStrip(state: CalendarUiState, onSelect: (LocalDate) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.padding(top = 6.dp).fillMaxWidth()) {
        state.weekDates.forEach { date ->
            val selected = date == state.selectedDate
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (selected) Tint else Color.Transparent)
                    .clickable { onSelect(date) }
                    .padding(vertical = 7.dp, horizontal = 2.dp),
            ) {
                Text(PolishDates.weekdayShort(date), style = B4UType.Pill.copy(fontSize = 10.sp), color = Muted)
                Text(
                    date.dayOfMonth.toString(),
                    style = B4UType.ItemTitleBold,
                    color = if (selected) Accent else Ink,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Box(
                    Modifier
                        .padding(top = 3.dp)
                        .size(4.dp)
                        .clip(CircleShape)
                        .background(if (date == state.today) Rose else Color.Transparent),
                )
            }
        }
    }
}

@Composable
private fun Filters(state: CalendarUiState, viewModel: CalendarViewModel) {
    val masters = state.catalog?.masters.orEmpty()
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) {
        val masterLabel = masters.find { it.id == state.filter.masterId }?.name ?: stringResource(R.string.filter_all_masters)
        FilterChipDropdown(
            label = stringResource(R.string.calendar_filter_master, masterLabel),
            options = listOf<Pair<String?, String>>(null to stringResource(R.string.filter_all_masters)) +
                masters.filter { it.isActive || it.id == state.filter.masterId }.map { it.id to it.name },
            onSelect = viewModel::setMasterFilter,
        )
        val statusLabel = state.filter.status?.let { stringResource(it.labelRes()) } ?: stringResource(R.string.filter_all_statuses)
        FilterChipDropdown(
            label = stringResource(R.string.calendar_filter_status, statusLabel),
            options = listOf<Pair<BookingStatus?, String>>(null to stringResource(R.string.filter_all_statuses)) +
                BookingStatus.entries.map { it to stringResource(it.labelRes()) },
            onSelect = viewModel::setStatusFilter,
        )
    }
}

@Composable
private fun <T> FilterChipDropdown(label: String, options: List<Pair<T, String>>, onSelect: (T) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(PillShape)
                .background(CardBg)
                .border(BorderStroke(1.dp, Border), PillShape)
                .clickable { expanded = true }
                .padding(horizontal = 12.dp, vertical = 7.dp),
        ) {
            Text(label, style = B4UType.Caption.copy(fontSize = 12.5.sp), color = Ink, maxLines = 1)
            Text(" ▾", style = B4UType.Caption, color = MutedLight)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, containerColor = CardBg) {
            options.forEach { (value, text) ->
                DropdownMenuItem(
                    text = { Text(text, style = B4UType.Body, color = Ink) },
                    onClick = {
                        expanded = false
                        onSelect(value)
                    },
                )
            }
        }
    }
}

@Composable
private fun GroupHeader(group: MasterGroup) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        modifier = Modifier.padding(top = 10.dp, bottom = 8.dp),
    ) {
        MasterPhoto(group.master.photo, size = 24.dp)
        ColorDot(masterColor(group.master.id), size = 9.dp)
        Text(group.master.name, style = B4UType.ItemTitle.copy(fontSize = 13.5.sp), color = Ink)
        Text(
            pluralStringResource(R.plurals.calendar_group_count, group.bookings.size, group.bookings.size),
            style = B4UType.CaptionSmall,
            color = Muted,
        )
    }
}

@Composable
private fun TimelineContent(state: CalendarUiState, catalog: Catalog, onOpenBooking: (Booking) -> Unit) {
    val day = state.selectedDate
    val bookings = CalendarLogic.timelineBookings(state.bookings, state.filter, day)
    val masters = CalendarLogic.timelineMasters(catalog.masters, state.filter, bookings)
    Column {
        TimelineGrid(
            day = day,
            masters = masters,
            bookings = bookings,
            blocks = state.blocks,
            schedule = state.schedule,
            catalog = catalog,
            onOpenBooking = onOpenBooking,
        )
        if (bookings.isEmpty()) {
            DashedEmptyState(
                title = stringResource(R.string.calendar_timeline_empty),
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}
