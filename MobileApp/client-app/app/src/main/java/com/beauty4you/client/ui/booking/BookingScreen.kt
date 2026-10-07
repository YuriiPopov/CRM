package com.beauty4you.client.ui.booking

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beauty4you.client.R
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.Master
import androidx.compose.ui.graphics.ImageBitmap
import com.beauty4you.client.data.Service
import com.beauty4you.client.data.ServicePhotos
import com.beauty4you.client.ui.common.ServiceCover
import com.beauty4you.client.data.Slot
import com.beauty4you.client.ui.BookingDraft
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.WeekSlots
import com.beauty4you.client.ui.common.OutlineButton
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.PushedHeader
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.bleed
import com.beauty4you.client.ui.common.formatDate
import com.beauty4you.client.ui.common.formatPrice
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.AppBackground
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.ButtonShape
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.CardShape
import com.beauty4you.client.ui.theme.ChipBg
import com.beauty4you.client.ui.theme.DisabledFg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.MutedLight
import com.beauty4you.client.ui.theme.TileShape
import java.time.LocalDate

/**
 * Полноэкранная запись «Rezerwacja» (item70). Отличия от прототипа — по ограничениям backend: мастер
 * выбирается до даты (свободное время считается для конкретного мастера), время — реальные слоты
 * /client/slots, блока оплаты нет (лояльность пока заглушка).
 */
@Composable
fun BookingScreen(vm: ClientViewModel, catalog: Catalog, draft: BookingDraft) {
    val today = LocalDate.now()
    val service = draft.serviceId?.let(catalog::service)
    val master = draft.masterId?.let(catalog::master)

    Column(Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 24.dp),
        ) {
            PushedHeader(stringResource(R.string.booking_title), onBack = vm::closeBooking)

            SectionLabel(stringResource(R.string.booking_service))
            ServiceGrid(
                services = bookableServices(catalog, draft.narrowToMasterId, draft.narrowToCategoryId),
                photos = vm.servicePhotos,
                selectedId = draft.serviceId,
                onSelect = vm::selectDraftService,
            )

            SectionLabel(stringResource(R.string.booking_master))
            val masters = bookableMasters(catalog, draft.serviceId, draft.narrowToMasterId, draft.narrowToCategoryId)
            if (masters.isEmpty()) {
                Hint(stringResource(R.string.booking_pick_service_first))
            } else {
                MasterRow(catalog, masters, draft.masterId, onSelect = vm::selectDraftMaster)
            }

            VSpace(22.dp)
            WeekCalendar(
                draft = draft,
                today = today,
                onPrevious = vm::showPreviousWeek,
                onNext = vm::showNextWeek,
                onSelect = vm::selectDraftDate,
            )

            SectionLabel(stringResource(R.string.booking_time))
            TimeSection(draft, onSelect = vm::selectDraftSlot, onRetry = vm::retrySlots)
        }

        SummaryBar(draft, service, master, onConfirm = vm::confirmBooking)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        style = B4UType.FieldLabel.copy(letterSpacing = 0.5.sp),
        color = Muted,
        modifier = Modifier.padding(top = 22.dp, bottom = 10.dp),
    )
}

@Composable
private fun Hint(text: String) {
    Text(text, style = B4UType.BodyMuted, color = MutedLight, modifier = Modifier.padding(vertical = 4.dp))
}

@Composable
private fun ServiceGrid(
    services: List<Service>,
    photos: ServicePhotos<ImageBitmap>,
    selectedId: String?,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        services.chunked(2).forEach { row ->
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { sv ->
                    val selected = sv.id == selectedId
                    Column(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(CardShape)
                            .background(if (selected) Accent else CardBg)
                            .border(1.dp, if (selected) Accent else Border, CardShape)
                            .clickable { onSelect(sv.id) }
                            .padding(horizontal = 12.dp, vertical = 11.dp),
                    ) {
                        // Превью обложки — только у услуг с фото; без фото плитка такая же, как раньше
                        val cover = sv.coverPhotoId?.takeIf { sv.hasPhotos }
                        if (cover != null) {
                            ServiceCover(photos, cover, size = 56.dp)
                            VSpace(8.dp)
                        }
                        Text(sv.name, style = B4UType.CardTitle, color = if (selected) Color.White else InkStrong)
                        VSpace(2.dp)
                        Text(
                            stringResource(R.string.duration_and_price, sv.durationMin, formatPrice(sv.price)),
                            style = B4UType.Caption,
                            color = if (selected) Color.White.copy(alpha = 0.85f) else Muted,
                        )
                    }
                }
                // Нечётное число услуг — пустая ячейка держит ширину последней карточки
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun MasterRow(catalog: Catalog, masters: List<Master>, selectedId: String?, onSelect: (String) -> Unit) {
    Row(
        Modifier
            .bleed(PagePadding)
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = PagePadding),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        masters.forEach { m ->
            val selected = m.id == selectedId
            Column(
                Modifier
                    .width(118.dp)
                    .clip(CardShape)
                    .background(CardBg)
                    .border(if (selected) 2.dp else 1.dp, if (selected) Accent else Border, CardShape)
                    .clickable { onSelect(m.id) }
                    .padding(8.dp),
            ) {
                MasterPhoto(m)
                VSpace(6.dp)
                Text(m.name, style = B4UType.CardTitle, color = InkStrong, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    m.serviceIds.mapNotNull { catalog.service(it)?.name }.joinToString(", "),
                    style = B4UType.Caption.copy(fontSize = 11.sp),
                    color = Muted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun MasterPhoto(master: Master) {
    val modifier = Modifier.fillMaxWidth().height(100.dp).clip(TileShape).background(ChipBg)
    val photo = master.photo
    if (photo != null) {
        Image(bitmap = photo, contentDescription = master.name, contentScale = ContentScale.Crop, modifier = modifier)
    } else {
        Box(modifier, contentAlignment = Alignment.Center) {
            Text(master.name.take(1).uppercase(), fontSize = 34.sp, color = master.color)
        }
    }
}

@Composable
private fun WeekCalendar(
    draft: BookingDraft,
    today: LocalDate,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onSelect: (LocalDate) -> Unit,
) {
    val months = stringArrayResource(R.array.months_short)
    val dayNames = stringArrayResource(R.array.weekdays_short)
    val days = weekDays(draft.weekStart)
    val canGoBack = canGoToPreviousWeek(draft.weekStart, today)

    Row(verticalAlignment = Alignment.CenterVertically) {
        ArrowButton("‹", stringResource(R.string.booking_prev_week), enabled = canGoBack, onClick = onPrevious)
        Text(
            weekTitle(days.first(), days.last(), months),
            style = B4UType.SectionHeader,
            color = Ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        ArrowButton("›", stringResource(R.string.booking_next_week), enabled = true, onClick = onNext)
    }
    VSpace(10.dp)
    Row {
        days.forEachIndexed { i, day ->
            val selected = day == draft.date
            val enabled = isDaySelectable(day, today, draft.week)
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    dayNames[i],
                    style = B4UType.SmallLabel,
                    color = if (selected) Accent else MutedLight,
                )
                VSpace(6.dp)
                Box(
                    Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(if (selected) Accent else if (enabled) CardBg else Color.Transparent)
                        .border(1.dp, if (selected || !enabled) Color.Transparent else Border, CircleShape)
                        .clickable(enabled = enabled) { onSelect(day) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        day.dayOfMonth.toString(),
                        style = B4UType.CardTitleBold,
                        color = when {
                            selected -> Color.White
                            enabled -> InkStrong
                            else -> DisabledFg.copy(alpha = 0.6f)
                        },
                    )
                }
            }
        }
    }
}

/** "Wrz – Paź 2026", "Paź 2026", "Gru 2026 – Sty 2027". */
private fun weekTitle(first: LocalDate, last: LocalDate, months: Array<String>): String {
    val a = months[first.monthValue - 1]
    val b = months[last.monthValue - 1]
    return when {
        first.year != last.year -> "$a ${first.year} – $b ${last.year}"
        first.month != last.month -> "$a – $b ${last.year}"
        else -> "$a ${last.year}"
    }
}

@Composable
private fun ArrowButton(symbol: String, description: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(36.dp)
            .clip(CircleShape)
            .clickable(enabled = enabled, onClickLabel = description, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(symbol, fontSize = 22.sp, color = if (enabled) Ink else Border)
    }
}

@Composable
private fun TimeSection(draft: BookingDraft, onSelect: (Slot) -> Unit, onRetry: () -> Unit) {
    val date = draft.date
    when (val week = draft.week) {
        null -> Hint(stringResource(R.string.booking_pick_master_first))
        WeekSlots.Loading -> Box(Modifier.fillMaxWidth().padding(vertical = 18.dp), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Accent, strokeWidth = 2.dp, modifier = Modifier.size(26.dp))
        }
        is WeekSlots.Failed -> Column {
            Hint(stringResource(week.message))
            VSpace(6.dp)
            OutlineButton(stringResource(R.string.retry), onClick = onRetry, bold = true)
        }
        is WeekSlots.Ready -> {
            val day = date?.let { week.days[it] }
            when {
                date == null || day == null -> Hint(stringResource(R.string.booking_no_days))
                !day.isWorkingDay -> Hint(stringResource(R.string.booking_day_off))
                day.slots.isEmpty() -> Hint(stringResource(R.string.booking_no_slots))
                else -> SlotGrid(day.slots, draft.selectedSlot, onSelect)
            }
        }
    }
}

@Composable
private fun SlotGrid(slots: List<Slot>, selected: Slot?, onSelect: (Slot) -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(CardBg)
            .border(1.dp, Border, CardShape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        slots.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { slot ->
                    val isSelected = slot == selected
                    Text(
                        slot.time.toString(),
                        style = B4UType.CardTitleBold,
                        color = if (isSelected) Color.White else InkStrong,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .weight(1f)
                            .clip(TileShape)
                            .background(if (isSelected) Accent else CardBg)
                            .border(1.dp, if (isSelected) Accent else Border, TileShape)
                            .clickable { onSelect(slot) }
                            .padding(vertical = 10.dp),
                    )
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun SummaryBar(draft: BookingDraft, service: Service?, master: Master?, onConfirm: () -> Unit) {
    val date = draft.date
    val summary = listOfNotNull(
        master?.name,
        date?.let { d -> formatDate(d) + (draft.selectedSlot?.let { ", ${it.time}" } ?: "") },
    ).joinToString(" · ")
    val enabled = draft.canConfirm

    Column(Modifier.background(CardBg).navigationBarsPadding()) {
        HorizontalDivider(color = Border)
        Column(Modifier.padding(start = PagePadding, end = PagePadding, top = 12.dp, bottom = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    summary,
                    style = B4UType.BodyMuted,
                    color = Muted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (service != null) {
                    Text(stringResource(R.string.price_zl, formatPrice(service.price)), style = B4UType.Total, color = Ink)
                }
            }
            VSpace(10.dp)
            Box(
                Modifier
                    .fillMaxWidth()
                    .alpha(if (enabled || draft.submitting) 1f else 0.5f)
                    .clip(ButtonShape)
                    .background(Accent)
                    .clickable(enabled = enabled, onClick = onConfirm)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (draft.submitting) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                } else {
                    Text(
                        stringResource(R.string.booking_confirm),
                        style = B4UType.Button.copy(fontSize = 14.sp, fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                }
            }
        }
    }
}
