package com.beauty4you.client.ui.screens

import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.Client
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.Tab
import com.beauty4you.client.ui.common.B4UCard
import com.beauty4you.client.ui.common.bleed
import com.beauty4you.client.ui.common.EmojiTile
import com.beauty4you.client.ui.common.MasterAvatar
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.SectionHeader
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.formatDate
import com.beauty4you.client.ui.common.formatPrice
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.LargeShape
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.MutedLight
import com.beauty4you.client.ui.theme.OnDarkMuted
import java.time.LocalDateTime

@Composable
fun HomeScreen(vm: ClientViewModel, catalog: Catalog, client: Client) {
    val points by vm.points.collectAsStateWithLifecycle()
    val bookings by vm.bookings.collectAsStateWithLifecycle()
    val now = LocalDateTime.now()
    val next = bookings.filter { it.isUpcoming(now) }.minByOrNull { it.start }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 24.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.home_greeting), style = B4UType.Body.copy(fontWeight = FontWeight.Medium), color = Muted)
                Text(client.firstName, style = B4UType.ScreenTitle, color = Ink)
            }
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .shadow(10.dp, RoundedCornerShape(16.dp), ambientColor = Ink.copy(alpha = 0.12f), spotColor = Ink.copy(alpha = 0.12f))
                    .clip(RoundedCornerShape(16.dp))
                    .background(CardBg)
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .padding(3.dp),
            ) {
                Image(
                    painter = painterResource(R.drawable.b4u_logo),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)),
                )
            }
        }

        VSpace(16.dp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            SectionHeader(stringResource(R.string.home_masters), Modifier.weight(1f))
            Text(
                stringResource(R.string.home_masters_all),
                style = B4UType.Caption.copy(fontWeight = FontWeight.Medium),
                color = MutedLight,
                modifier = Modifier.clickable { vm.selectTab(Tab.SERVICES) },
            )
        }
        VSpace(10.dp)
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(horizontal = PagePadding),
            modifier = Modifier.bleed(PagePadding),
        ) {
            items(catalog.masters, key = { it.id }) { m ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable { vm.openMaster(m.id) },
                ) {
                    MasterAvatar(m, 56.dp)
                    VSpace(6.dp)
                    Text(m.name, style = B4UType.SmallLabel, color = InkStrong)
                }
            }
        }

        VSpace(16.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickAction("📅", stringResource(R.string.book), Modifier.weight(1f)) { vm.startBooking() }
            QuickAction("🕒", stringResource(R.string.home_my_bookings), Modifier.weight(1f)) { vm.selectTab(Tab.BOOKINGS) }
            QuickAction("⭐", stringResource(R.string.points_value, points), Modifier.weight(1f)) { vm.openLoyalty() }
        }

        VSpace(26.dp)
        SectionHeader(stringResource(R.string.home_popular))
        VSpace(10.dp)
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(horizontal = PagePadding),
            modifier = Modifier.bleed(PagePadding),
        ) {
            items(catalog.services.take(4), key = { it.id }) { sv ->
                B4UCard(
                    modifier = Modifier.width(140.dp),
                    onClick = { vm.startBooking(sv.id) },
                    contentPadding = PaddingValues(12.dp),
                ) {
                    EmojiTile(sv.emoji, Modifier.fillMaxWidth().height(70.dp))
                    VSpace(8.dp)
                    // Две строки у всех карточек — чтобы длинные названия не обрезались, а высота
                    // карточек в карусели оставалась одинаковой.
                    Text(sv.name, style = B4UType.CardTitle.copy(fontSize = 12.5.sp), color = InkStrong, minLines = 2, maxLines = 2)
                    VSpace(2.dp)
                    Text(
                        stringResource(R.string.price_and_duration, formatPrice(sv.price), sv.durationMin),
                        style = B4UType.Button,
                        color = Accent,
                    )
                }
            }
        }

        if (next != null) {
            VSpace(22.dp)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LargeShape)
                    .background(Ink)
                    .clickable { vm.selectTab(Tab.BOOKINGS) }
                    .padding(16.dp),
            ) {
                Text(
                    stringResource(R.string.home_next_visit).uppercase(),
                    style = B4UType.SmallLabel.copy(fontWeight = FontWeight.Normal, letterSpacing = 0.55.sp),
                    color = OnDarkMuted,
                )
                VSpace(4.dp)
                Text(
                    stringResource(R.string.home_next_visit_line, next.serviceName, formatDate(next.date), next.time.toString()),
                    style = B4UType.RowTitle,
                    color = Color.White,
                )
                VSpace(2.dp)
                Text(next.masterName, style = B4UType.Caption, color = OnDarkMuted)
            }
        }
    }
}

@Composable
private fun QuickAction(emoji: String, label: String, modifier: Modifier, onClick: () -> Unit) {
    B4UCard(modifier = modifier, onClick = onClick, contentPadding = PaddingValues(horizontal = 6.dp, vertical = 12.dp)) {
        Text(emoji, fontSize = 20.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
        VSpace(4.dp)
        Text(label, style = B4UType.SmallLabel, color = InkStrong, modifier = Modifier.align(Alignment.CenterHorizontally))
    }
}
