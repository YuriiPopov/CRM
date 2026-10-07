package com.beauty4you.client.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.B4URowCard
import com.beauty4you.client.ui.common.Overline
import com.beauty4you.client.ui.common.ServiceCover
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.ScreenTitle
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.bleed
import com.beauty4you.client.ui.common.formatPrice
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.ChipBg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.PillShape

@Composable
fun ServicesScreen(vm: ClientViewModel, catalog: Catalog) {
    val nav by vm.nav.collectAsStateWithLifecycle()
    val selected = nav.servicesCategoryId
    val groups = catalog.categories
        .filter { selected == null || it.id == selected }
        .map { cat -> cat to catalog.services.filter { it.categoryId == cat.id } }
        .filter { (_, services) -> services.isNotEmpty() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 40.dp),
    ) {
        item {
            ScreenTitle(stringResource(R.string.tab_services))
            VSpace(14.dp)
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                contentPadding = PaddingValues(horizontal = PagePadding),
                modifier = Modifier.bleed(PagePadding),
            ) {
                item { CategoryChip(stringResource(R.string.services_all), selected == null) { vm.setServicesCategory(null) } }
                items(catalog.categories, key = { it.id }) { cat -> CategoryChip(cat.name, selected == cat.id) { vm.setServicesCategory(cat.id) } }
            }
        }
        groups.forEach { (category, services) ->
            item(key = "h-${category.id}") {
                Overline(category.name, Modifier.padding(top = 20.dp, bottom = 8.dp))
            }
            items(services, key = { it.id }) { sv ->
                Column(Modifier.padding(bottom = 8.dp)) {
                    // Карточка с галереей — только у услуг с фото; без фото строка такая же, как раньше
                    B4URowCard(onClick = if (sv.hasPhotos) ({ vm.openService(sv.id) }) else null) {
                        sv.coverPhotoId?.takeIf { sv.hasPhotos }?.let { ServiceCover(vm.servicePhotos, it) }
                        Column(Modifier.weight(1f)) {
                            Text(sv.name, style = B4UType.CardTitle, color = InkStrong)
                            VSpace(1.dp)
                            Text(
                                stringResource(R.string.duration_and_price, sv.durationMin, formatPrice(sv.price)),
                                style = B4UType.Caption.copy(fontSize = 11.5.sp),
                                color = Muted,
                            )
                        }
                        AccentButton(stringResource(R.string.book), onClick = { vm.startBooking(sv.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryChip(label: String, active: Boolean, onClick: () -> Unit) {
    Text(
        label,
        style = B4UType.CaptionStrong.copy(fontSize = 12.5.sp),
        color = if (active) Color.White else Ink,
        modifier = Modifier
            .clip(PillShape)
            .background(if (active) Accent else ChipBg)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}
