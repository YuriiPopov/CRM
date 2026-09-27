package com.beauty4you.client.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.data.Booking
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.common.B4UCard
import com.beauty4you.client.ui.common.EmptyState
import com.beauty4you.client.ui.common.OutlineButton
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.ScreenTitle
import com.beauty4you.client.ui.common.StatusPill
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.formatDate
import com.beauty4you.client.ui.common.formatPrice
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.CancelBorder
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.ChipBg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.StatusCancelled
import java.time.LocalDateTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingsScreen(vm: ClientViewModel) {
    val nav by vm.nav.collectAsStateWithLifecycle()
    val bookings by vm.bookings.collectAsStateWithLifecycle()
    val refreshing by vm.refreshing.collectAsStateWithLifecycle()
    val now = LocalDateTime.now()
    // Nadchodzące — ближайшая сверху; Minione — самая свежая сверху
    val filtered = if (nav.bookingsShowUpcoming) {
        bookings.filter { it.isUpcoming(now) }.sortedBy { it.start }
    } else {
        bookings.filterNot { it.isUpcoming(now) }.sortedByDescending { it.start }
    }

    PullToRefreshBox(isRefreshing = refreshing, onRefresh = vm::refreshBookings, modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            item {
                Column(Modifier.padding(bottom = 5.dp)) {
                    ScreenTitle(stringResource(R.string.home_my_bookings))
                    VSpace(14.dp)
                    SegmentedControl(
                        upcoming = nav.bookingsShowUpcoming,
                        onSelect = vm::setBookingsUpcoming,
                    )
                    if (filtered.isEmpty()) {
                        VSpace(16.dp)
                        EmptyState(stringResource(R.string.bookings_empty_title), stringResource(R.string.bookings_empty_text))
                    }
                }
            }
            items(filtered, key = { it.id }) { b -> BookingCard(vm, b, upcoming = nav.bookingsShowUpcoming) }
        }

        val newLabel = stringResource(R.string.bookings_new)
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = PagePadding, bottom = 20.dp)
                .size(52.dp)
                .shadow(12.dp, CircleShape, ambientColor = Accent, spotColor = Accent)
                .clip(CircleShape)
                .background(Accent)
                .clickable { vm.startBooking() }
                .semantics { contentDescription = newLabel },
            contentAlignment = Alignment.Center,
        ) {
            Text("+", color = Color.White, fontSize = 26.sp)
        }
    }
}

@Composable
private fun SegmentedControl(upcoming: Boolean, onSelect: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(ChipBg)
            .padding(3.dp),
    ) {
        Segment(stringResource(R.string.bookings_upcoming), upcoming, Modifier.weight(1f)) { onSelect(true) }
        Segment(stringResource(R.string.bookings_past), !upcoming, Modifier.weight(1f)) { onSelect(false) }
    }
}

@Composable
private fun Segment(label: String, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(9.dp))
            .background(if (active) CardBg else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = B4UType.Body.copy(fontWeight = FontWeight.SemiBold), color = if (active) Ink else Muted)
    }
}

@Composable
private fun BookingCard(vm: ClientViewModel, b: Booking, upcoming: Boolean) {
    B4UCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 13.dp)) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(b.serviceName, style = B4UType.CardTitleBold, color = InkStrong, modifier = Modifier.weight(1f))
            StatusPill(b.status)
        }
        VSpace(3.dp)
        Text(
            stringResource(R.string.bookings_meta, formatDate(b.date), b.time.toString(), b.masterName),
            style = B4UType.Caption,
            color = Muted,
        )
        VSpace(2.dp)
        Text(stringResource(R.string.price_zl, formatPrice(b.price)), style = B4UType.CaptionStrong, color = Ink)
        VSpace(9.dp)
        if (upcoming) {
            OutlineButton(
                stringResource(R.string.bookings_cancel),
                onClick = { vm.cancelBooking(b.id) },
                modifier = Modifier.fillMaxWidth(),
                color = StatusCancelled.fg,
                borderColor = CancelBorder,
            )
        } else {
            OutlineButton(
                stringResource(R.string.bookings_repeat),
                onClick = { vm.repeatBooking(b.id) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
