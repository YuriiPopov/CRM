package com.beauty4you.client.ui.booking

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.PaymentMethod
import com.beauty4you.client.ui.BookingDraft
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.formatDate
import com.beauty4you.client.ui.common.formatPrice
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.ButtonShape
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.DashedBorder
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.MutedLight
import com.beauty4you.client.ui.theme.Scrim
import com.beauty4you.client.ui.theme.SheetBg
import com.beauty4you.client.ui.theme.SheetShape
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingSheet(vm: ClientViewModel, catalog: Catalog, draft: BookingDraft) {
    val points by vm.points.collectAsStateWithLifecycle()
    val service = catalog.service(draft.serviceId) ?: return
    val master = catalog.master(draft.masterId) ?: return
    val usingPoints = draft.payment == PaymentMethod.POINTS
    val total = if (usingPoints) service.price - minOf(service.price, points.toDouble()) else service.price
    var showDatePicker by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = vm::closeBooking,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        shape = SheetShape,
        containerColor = SheetBg,
        scrimColor = Scrim,
        dragHandle = {
            Box(
                Modifier
                    .padding(top = 18.dp, bottom = 16.dp)
                    .size(width = 36.dp, height = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(DashedBorder),
            )
        },
    ) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(start = 20.dp, end = 20.dp, bottom = 28.dp)
                .navigationBarsPadding(),
        ) {
            Text(stringResource(R.string.bookings_new), style = B4UType.SheetTitle, color = Ink)

            VSpace(16.dp)
            PickerField(
                label = stringResource(R.string.sheet_service),
                value = stringResource(R.string.sheet_service_value, service.name, formatPrice(service.price)),
                options = catalog.services,
                optionLabel = { stringResource(R.string.sheet_service_value, it.name, formatPrice(it.price)) },
                onSelect = { vm.selectDraftService(it.id) },
            )

            VSpace(12.dp)
            PickerField(
                label = stringResource(R.string.sheet_master),
                value = master.name,
                // Только мастера, оказывающие выбранную услугу.
                options = catalog.mastersFor(draft.serviceId),
                optionLabel = { it.name },
                onSelect = { vm.selectDraftMaster(it.id) },
            )

            VSpace(12.dp)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f)) {
                    FieldLabel(stringResource(R.string.sheet_date))
                    FieldBox(formatDate(draft.date)) { showDatePicker = true }
                }
                Column(Modifier.weight(1f)) {
                    // Свободные слоты мастера на выбранный день — с backend (/client/slots)
                    PickerField(
                        label = stringResource(R.string.sheet_time),
                        value = when {
                            draft.slotsLoading -> "…"
                            draft.selectedSlot == null -> "—"
                            else -> draft.selectedSlot.time.toString()
                        },
                        options = draft.slots,
                        optionLabel = { it.time.toString() },
                        onSelect = vm::selectDraftSlot,
                        enabled = draft.slots.isNotEmpty(),
                    )
                }
            }
            if (!draft.slotsLoading && draft.slots.isEmpty()) {
                Text(
                    stringResource(R.string.sheet_no_slots),
                    style = B4UType.Caption,
                    color = MutedLight,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            VSpace(12.dp)
            PickerField(
                label = stringResource(R.string.sheet_payment),
                value = paymentLabel(draft.payment),
                options = PaymentMethod.entries,
                optionLabel = { paymentLabel(it) },
                onSelect = vm::selectDraftPayment,
            )
            if (usingPoints) {
                Text(
                    stringResource(R.string.sheet_points_local),
                    style = B4UType.Caption,
                    color = MutedLight,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            VSpace(16.dp)
            HorizontalDivider(color = Border)
            Row(Modifier.padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.sheet_total), style = B4UType.BodyMuted, color = Muted, modifier = Modifier.weight(1f))
                Text(
                    if (usingPoints) stringResource(R.string.sheet_total_points, formatPrice(total))
                    else stringResource(R.string.price_zl, formatPrice(total)),
                    style = B4UType.Total,
                    color = Ink,
                )
            }

            VSpace(16.dp)
            val canConfirm = draft.selectedSlot != null && !draft.submitting
            AccentButton(
                stringResource(R.string.sheet_confirm),
                onClick = { if (canConfirm) vm.confirmBooking() },
                modifier = Modifier.fillMaxWidth().alpha(if (canConfirm) 1f else 0.5f),
                large = true,
            )
        }
    }

    if (showDatePicker) {
        val todayUtc = LocalDate.now().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val state = rememberDatePickerState(
            initialSelectedDateMillis = draft.date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis >= todayUtc
            },
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { millis ->
                        vm.selectDraftDate(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate())
                    }
                    showDatePicker = false
                }) { Text(stringResource(R.string.date_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text(stringResource(R.string.date_cancel)) }
            },
        ) {
            DatePicker(state = state)
        }
    }
}

@Composable
private fun paymentLabel(method: PaymentMethod) = stringResource(
    when (method) {
        PaymentMethod.IN_SALON -> R.string.pay_in_salon
        PaymentMethod.POINTS -> R.string.pay_with_points
    },
)

@Composable
private fun FieldLabel(text: String) {
    Text(text, style = B4UType.FieldLabel, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
}

@Composable
private fun FieldBox(value: String, enabled: Boolean = true, onClick: () -> Unit) {
    Text(
        value,
        style = B4UType.CardTitle,
        color = InkStrong,
        maxLines = 1,
        modifier = Modifier
            .fillMaxWidth()
            .clip(ButtonShape)
            .background(CardBg)
            .border(1.dp, Border, ButtonShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
    )
}

@Composable
private fun <T> PickerField(
    label: String,
    value: String,
    options: List<T>,
    optionLabel: @Composable (T) -> String,
    onSelect: (T) -> Unit,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        FieldLabel(label)
        Box {
            FieldBox(value, enabled) { expanded = true }
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                containerColor = CardBg,
                // Слотов на день бывает 30+ — ограничиваем высоту, список скроллится
                modifier = Modifier.heightIn(max = 320.dp),
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(optionLabel(option), style = B4UType.CardTitle, color = InkStrong) },
                        onClick = {
                            onSelect(option)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}
