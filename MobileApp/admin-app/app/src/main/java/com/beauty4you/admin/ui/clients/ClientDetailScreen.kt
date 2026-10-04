package com.beauty4you.admin.ui.clients

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.ClientLogic
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.ui.common.B4UCard
import com.beauty4you.admin.ui.common.BookingCard
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.InitialsAvatar
import com.beauty4you.admin.ui.common.RefreshOnResume
import com.beauty4you.admin.ui.common.ScreenHeader
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.UnreliableBadge
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.Rose
import java.time.LocalDate

@Composable
fun ClientDetailScreen(clientId: String, onBack: () -> Unit, onOpenBooking: (Booking) -> Unit) {
    val viewModel: ClientDetailViewModel = viewModel(
        key = "client-$clientId",
        factory = ClientDetailViewModel.factory(appContainer(), clientId),
    )
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val today = LocalDate.now()
    RefreshOnResume { viewModel.load(silent = state.client != null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item { ScreenHeader(title = stringResource(R.string.client_title), onBack = onBack) }

        val client = state.client
        when {
            state.loading -> item { SkeletonList(rows = 4) }
            state.error || client == null -> item { ErrorState(onRetry = { viewModel.load() }) }
            else -> {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 8.dp).fillMaxWidth(),
                    ) {
                        InitialsAvatar(client.id, client.name, size = 56.dp)
                        Column(Modifier.weight(1f).padding(start = 14.dp)) {
                            Text(client.name, style = B4UType.Title, color = InkStrong)
                            UnreliableBadge(client, Modifier.padding(top = 4.dp))
                            // Тап по телефону — звонок (ACTION_DIAL, без разрешения CALL_PHONE)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(top = 2.dp).clickable {
                                    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${client.phone.filter { it.isDigit() || it == '+' }}")))
                                },
                            ) {
                                Icon(Icons.Filled.Call, contentDescription = null, tint = Rose, modifier = Modifier.size(14.dp))
                                Text(ClientLogic.formatPhone(client.phone), style = B4UType.Caption.copy(fontSize = 12.5.sp), color = Rose, modifier = Modifier.padding(start = 4.dp))
                            }
                        }
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 10.dp)) {
                        StatTile(state.stats.completedVisits, R.string.client_visits_total, Modifier.weight(1f))
                        StatTile(state.stats.upcoming, R.string.client_upcoming, Modifier.weight(1f))
                    }
                }
                item {
                    Text(
                        stringResource(R.string.client_history),
                        style = B4UType.SectionHeaderSmall,
                        color = Ink,
                        modifier = Modifier.padding(top = 14.dp, bottom = 2.dp),
                    )
                }
                if (state.history.isEmpty()) {
                    item { Text(stringResource(R.string.client_history_empty), style = B4UType.Caption, color = Muted) }
                }
                items(state.history, key = { it.booking.id }) { item ->
                    BookingCard(
                        item = item,
                        today = today,
                        onClick = { onOpenBooking(item.booking) },
                        subtitle = "${PolishDates.shortDate(item.booking.date, today)}, ${PolishDates.time(item.booking.start.toLocalTime())} · ${item.masterName}",
                    )
                }
            }
        }
    }
}

@Composable
private fun StatTile(value: Int, label: Int, modifier: Modifier) {
    B4UCard(modifier = modifier) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(12.dp)) {
            Text(value.toString(), style = B4UType.Stat, color = Ink)
            Text(stringResource(label), style = B4UType.Tiny, color = Muted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}
