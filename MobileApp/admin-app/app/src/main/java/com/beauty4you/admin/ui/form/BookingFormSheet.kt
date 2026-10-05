package com.beauty4you.admin.ui.form

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.BookingSource
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.domain.Client
import com.beauty4you.admin.domain.ClientLogic
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.ui.common.ColorDot
import com.beauty4you.admin.ui.common.InitialsAvatar
import com.beauty4you.admin.ui.common.UnreliableBadge
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.common.colors
import com.beauty4you.admin.ui.common.labelRes
import com.beauty4you.admin.ui.common.messageRes
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.DangerBorder
import com.beauty4you.admin.ui.theme.DashedBorder
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.PillShape
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.SheetBackground
import com.beauty4you.admin.ui.theme.SheetShape
import com.beauty4you.admin.ui.theme.SoftBackground
import com.beauty4you.admin.ui.theme.StatusCancelled
import com.beauty4you.admin.ui.theme.Tint
import com.beauty4you.admin.ui.theme.masterColor
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingFormSheet(request: FormRequest, onDismiss: () -> Unit) {
    val viewModel: BookingFormViewModel = viewModel(factory = BookingFormViewModel.factory(appContainer()))
    val state by viewModel.state.collectAsState()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(request) { viewModel.start(request) }
    LaunchedEffect(state.closed) { if (state.closed) onDismiss() }

    var showClientPicker by remember { mutableStateOf(false) }
    var showDatePicker by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = SheetShape,
        containerColor = SheetBackground,
        dragHandle = {
            Box(
                Modifier
                    .padding(top = 12.dp, bottom = 4.dp)
                    .size(width = 36.dp, height = 4.dp)
                    .clip(PillShape)
                    .background(DashedBorder),
            )
        },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp)
                .navigationBarsPadding(),
        ) {
            val title = when (state.mode) {
                FormMode.NEW -> R.string.form_title_new
                FormMode.EDIT -> R.string.form_title_edit
                FormMode.READ_ONLY -> R.string.form_title_view
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(title), style = B4UType.SheetTitle, color = Ink, modifier = Modifier.weight(1f))
                if (state.original?.source == BookingSource.ONLINE) {
                    Text(
                        stringResource(R.string.form_online_badge),
                        style = B4UType.Pill,
                        color = Rose,
                        modifier = Modifier.clip(PillShape).background(Tint).padding(horizontal = 9.dp, vertical = 3.dp),
                    )
                }
            }

            val catalog = state.catalog
            if (state.loading || catalog == null) {
                Box(Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                    if (state.loading) CircularProgressIndicator(color = Rose) else ErrorText(state)
                }
                return@Column
            }

            val editable = state.mode != FormMode.READ_ONLY
            val isNew = state.mode == FormMode.NEW

            FieldLabel(R.string.form_client, top = 16.dp)
            FieldButton(
                text = state.clientId?.let { catalog.clientName(it) } ?: stringResource(R.string.form_pick_client),
                placeholder = state.clientId == null,
                enabled = isNew,
                onClick = { showClientPicker = true },
            )
            state.clientId?.let { catalog.clientsById[it] }?.let { client ->
                UnreliableBadge(client, Modifier.padding(top = 6.dp))
            }

            FieldLabel(R.string.form_master)
            DropdownField(
                text = state.masterId?.let { catalog.masterName(it) } ?: stringResource(R.string.form_pick_master),
                placeholder = state.masterId == null,
                enabled = editable,
                leadingColor = state.masterId?.let { masterColor(it) },
                options = state.masterOptions.map { it.id to it.name },
                onSelect = viewModel::selectMaster,
            )

            FieldLabel(R.string.form_service)
            DropdownField(
                text = state.serviceId?.let { catalog.serviceName(it) } ?: stringResource(R.string.form_pick_service),
                placeholder = state.serviceId == null,
                enabled = isNew,
                options = state.serviceOptions.map { it.id to "${it.name} · ${it.durationMin} min" },
                onSelect = viewModel::selectService,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    FieldLabel(R.string.form_date)
                    FieldButton(
                        text = "${PolishDates.weekdayShort(state.date)}, ${PolishDates.shortDate(state.date, LocalDate.now())}",
                        enabled = editable,
                        onClick = { showDatePicker = true },
                    )
                }
                Column(Modifier.weight(1f)) {
                    FieldLabel(R.string.form_time)
                    FieldButton(
                        text = state.time?.let { PolishDates.time(it) } ?: "—",
                        placeholder = state.time == null,
                        enabled = false,
                        onClick = {},
                    )
                }
            }
            if (editable) TimeSlots(state, viewModel::selectTime)

            FieldLabel(R.string.form_status)
            StatusField(state, viewModel::selectStatus)

            when (state.mode) {
                FormMode.EDIT -> Hint(R.string.form_locked_hint)
                FormMode.READ_ONLY -> Hint(R.string.form_readonly_hint)
                FormMode.NEW -> Unit
            }

            ErrorText(state)

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 20.dp).fillMaxWidth()) {
                if (state.canCancel) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(FieldShape)
                            .background(CardBg)
                            .border(BorderStroke(1.dp, DangerBorder), FieldShape)
                            .clickable(enabled = !state.saving) { viewModel.askCancel() }
                            .padding(vertical = 13.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(stringResource(R.string.form_delete), style = B4UType.ItemTitle, color = StatusCancelled.fg)
                    }
                }
                val primaryEnabled = if (editable) state.canSave else true
                Box(
                    modifier = Modifier
                        .weight(2f)
                        .clip(FieldShape)
                        .background(if (primaryEnabled) Rose else Rose.copy(alpha = 0.45f))
                        .clickable(enabled = primaryEnabled) { if (editable) viewModel.save() else onDismiss() }
                        .padding(vertical = 13.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    if (state.saving) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                    } else {
                        Text(
                            stringResource(if (editable) R.string.form_save else R.string.form_close),
                            style = B4UType.Button,
                            color = Color.White,
                        )
                    }
                }
            }
        }
    }

    if (showClientPicker) {
        ClientPickerDialog(
            clients = state.catalog?.clients.orEmpty(),
            onPick = {
                viewModel.selectClient(it)
                showClientPicker = false
            },
            onDismiss = { showClientPicker = false },
        )
    }

    if (showDatePicker) {
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = state.date.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let {
                        viewModel.selectDate(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate())
                    }
                    showDatePicker = false
                }) { Text(stringResource(R.string.form_pick_date_ok), color = Rose) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text(stringResource(R.string.form_pick_date_cancel), color = Muted)
                }
            },
        ) {
            DatePicker(
                state = pickerState,
                showModeToggle = false,
                colors = DatePickerDefaults.colors(selectedDayContainerColor = Rose, todayDateBorderColor = Rose, todayContentColor = Rose),
            )
        }
    }

    if (state.confirmCancel) {
        AlertDialog(
            onDismissRequest = viewModel::dismissCancel,
            title = { Text(stringResource(R.string.form_cancel_confirm_title), style = B4UType.SheetTitle, color = Ink) },
            text = { Text(stringResource(R.string.form_cancel_confirm_text), style = B4UType.Body, color = Muted) },
            confirmButton = {
                TextButton(onClick = viewModel::confirmCancel) {
                    Text(stringResource(R.string.form_cancel_confirm_yes), color = StatusCancelled.fg, style = B4UType.Button)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissCancel) {
                    Text(stringResource(R.string.form_cancel_confirm_no), color = Muted)
                }
            },
            containerColor = SheetBackground,
        )
    }
}

@Composable
internal fun FieldLabel(text: Int, top: Dp = 12.dp) {
    Text(
        stringResource(text),
        style = B4UType.Label,
        color = Muted,
        modifier = Modifier.padding(top = top, bottom = 6.dp),
    )
}

@Composable
private fun FieldButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    placeholder: Boolean = false,
    leadingColor: Color? = null,
    background: Color = CardBg,
    textColor: Color? = null,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(FieldShape)
            .background(if (enabled) background else if (background == CardBg) SoftBackground else background)
            .border(BorderStroke(1.dp, Border), FieldShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
    ) {
        if (leadingColor != null) {
            ColorDot(leadingColor)
            Spacer(Modifier.size(8.dp))
        }
        Text(
            text,
            style = B4UType.ItemTitle,
            color = textColor ?: if (placeholder) Muted else InkStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (enabled) Text("▾", style = B4UType.Caption, color = Muted)
    }
}

@Composable
private fun DropdownField(
    text: String,
    placeholder: Boolean,
    enabled: Boolean,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit,
    leadingColor: Color? = null,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        FieldButton(text = text, placeholder = placeholder, enabled = enabled, leadingColor = leadingColor, onClick = { expanded = true })
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, containerColor = CardBg) {
            if (options.isEmpty()) {
                DropdownMenuItem(text = { Text(stringResource(R.string.form_no_options), color = Muted) }, onClick = { expanded = false })
            }
            options.forEach { (id, label) ->
                DropdownMenuItem(
                    text = { Text(label, style = B4UType.Body, color = Ink) },
                    onClick = {
                        expanded = false
                        onSelect(id)
                    },
                )
            }
        }
    }
}

@Composable
private fun StatusField(state: BookingFormState, onSelect: (BookingStatus) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val colors = state.status.colors()
    Box {
        FieldButton(
            text = stringResource(state.status.labelRes()),
            enabled = state.mode != FormMode.READ_ONLY && state.statusOptions.size > 1,
            background = colors.bg,
            textColor = colors.fg,
            onClick = { expanded = true },
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, containerColor = CardBg) {
            state.statusOptions.forEach { status ->
                DropdownMenuItem(
                    text = { Text(stringResource(status.labelRes()), style = B4UType.ItemTitle, color = status.colors().fg) },
                    onClick = {
                        expanded = false
                        onSelect(status)
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TimeSlots(state: BookingFormState, onSelect: (LocalTime) -> Unit) {
    val message = when (val slots = state.slots) {
        SlotsState.NeedSelection -> R.string.form_time_pick_first
        SlotsState.Loading -> R.string.form_time_loading
        SlotsState.Error -> R.string.form_time_error
        is SlotsState.Loaded -> when {
            !slots.isWorkingDay -> R.string.form_time_day_off
            state.timeOptions.isEmpty() -> R.string.form_time_none
            else -> null
        }
    }
    if (message != null) {
        Text(stringResource(message), style = B4UType.Caption, color = Muted, modifier = Modifier.padding(top = 8.dp))
        return
    }
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.padding(top = 8.dp),
    ) {
        state.timeOptions.forEach { time ->
            val selected = time == state.time
            Text(
                PolishDates.time(time),
                style = B4UType.BodyStrong,
                color = if (selected) Color.White else Ink,
                modifier = Modifier
                    .clip(PillShape)
                    .background(if (selected) Rose else CardBg)
                    .border(BorderStroke(1.dp, if (selected) Rose else Border), PillShape)
                    .clickable { onSelect(time) }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun Hint(text: Int) {
    Text(stringResource(text), style = B4UType.CaptionSmall, color = Muted, modifier = Modifier.padding(top = 12.dp))
}

@Composable
private fun ErrorText(state: BookingFormState) {
    state.error?.let {
        Text(
            stringResource(it.messageRes()),
            style = B4UType.Caption.copy(fontSize = 12.5.sp),
            color = StatusCancelled.fg,
            modifier = Modifier
                .padding(top = 14.dp)
                .fillMaxWidth()
                .clip(FieldShape)
                .background(StatusCancelled.bg)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun ClientPickerDialog(
    clients: List<Client>,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val results = ClientLogic.search(clients, query)
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SheetBackground,
        title = { Text(stringResource(R.string.form_pick_client), style = B4UType.SheetTitle, color = Ink) },
        text = {
            Column {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text(stringResource(R.string.form_search_client), style = B4UType.Body) },
                    singleLine = true,
                    shape = FieldShape,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Rose,
                        unfocusedBorderColor = Border,
                        focusedContainerColor = CardBg,
                        unfocusedContainerColor = CardBg,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (results.isEmpty()) {
                    Text(stringResource(R.string.form_no_clients_found), style = B4UType.Caption, color = Muted, modifier = Modifier.padding(top = 12.dp))
                }
                LazyColumn(modifier = Modifier.padding(top = 8.dp).heightIn(max = 360.dp)) {
                    items(results, key = { it.id }) { client ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onPick(client.id) }
                                .padding(vertical = 8.dp),
                        ) {
                            InitialsAvatar(client.id, client.name, size = 32.dp)
                            Column(Modifier.padding(start = 10.dp)) {
                                Text(client.name, style = B4UType.ItemTitle, color = InkStrong)
                                Text(ClientLogic.formatPhone(client.phone), style = B4UType.CaptionSmall, color = Muted)
                                UnreliableBadge(client, Modifier.padding(top = 3.dp))
                            }
                        }
                        HorizontalDivider(color = Border)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.form_pick_date_cancel), color = Muted) }
        },
    )
}
