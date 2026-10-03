package com.beauty4you.client.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beauty4you.client.R
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.B4URowCard
import com.beauty4you.client.ui.common.HSpace
import com.beauty4you.client.ui.common.MasterAvatar
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.PushedHeader
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.formatPrice
import com.beauty4you.client.ui.theme.AppBackground
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted

// Рейтинг, портфолио и отзывы из прототипа не показываются: на backend этих данных пока нет,
// а выдуманные цифры рядом с реальными мастерами вводили бы клиента в заблуждение.
@Composable
fun MasterDetailScreen(vm: ClientViewModel, catalog: Catalog, masterId: String) {
    val master = catalog.master(masterId)
    if (master == null) {
        // Мастер пропал из каталога после обновления (деактивирован в салоне)
        LaunchedEffect(masterId) { vm.back() }
        return
    }
    val services = master.serviceIds.mapNotNull(catalog::service)

    Column(Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 24.dp),
        ) {
            PushedHeader(stringResource(R.string.master_title), onBack = vm::back)

            VSpace(16.dp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                MasterAvatar(master, 76.dp)
                HSpace(14.dp)
                Column(Modifier.weight(1f)) {
                    Text(master.name, style = B4UType.MasterName, color = InkStrong)
                    if (master.specialty.isNotEmpty()) {
                        VSpace(2.dp)
                        Text(master.specialty, style = B4UType.BodyMuted, color = Muted)
                    }
                }
            }

            Text(
                stringResource(R.string.master_services),
                style = B4UType.SubSection,
                color = Ink,
                modifier = Modifier.padding(top = 22.dp, bottom = 10.dp),
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                services.forEach { sv ->
                    B4URowCard {
                        Column(Modifier.weight(1f)) {
                            Text(sv.name, style = B4UType.CardTitle, color = InkStrong)
                            VSpace(1.dp)
                            Text(stringResource(R.string.duration_min, sv.durationMin), style = B4UType.Caption.copy(fontSize = 11.5.sp), color = Muted)
                        }
                        Text(stringResource(R.string.price_zl, formatPrice(sv.price)), style = B4UType.Body.copy(fontWeight = FontWeight.Bold), color = Ink)
                        AccentButton(stringResource(R.string.master_choose), onClick = { vm.startBooking(sv.id, master.id, fromMaster = true) })
                    }
                }
            }
        }

        // Липкая нижняя CTA-панель.
        HorizontalDivider(color = Border)
        Box(Modifier.fillMaxWidth().background(AppBackground).padding(horizontal = PagePadding, vertical = 14.dp)) {
            AccentButton(
                stringResource(R.string.master_book_with, master.name),
                onClick = { vm.startBooking(masterId = master.id, fromMaster = true) },
                modifier = Modifier.fillMaxWidth(),
                large = true,
            )
        }
    }
}
