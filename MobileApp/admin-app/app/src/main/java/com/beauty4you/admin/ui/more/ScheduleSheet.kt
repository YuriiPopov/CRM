package com.beauty4you.admin.ui.more

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.DaySchedule
import com.beauty4you.admin.domain.DayStatus
import com.beauty4you.admin.domain.HoursError
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.domain.ScheduleConflict
import com.beauty4you.admin.domain.ScheduleError
import com.beauty4you.admin.domain.ScheduleLogic
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.FormErrorBanner
import com.beauty4you.admin.ui.common.FormHint
import com.beauty4you.admin.ui.common.FormSheet
import com.beauty4you.admin.ui.common.SelectChip
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.TimeDropdown
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.form.FieldLabel
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.StatusCancelled
import com.beauty4you.admin.ui.theme.StatusConfirmed
import com.beauty4you.admin.ui.theme.StatusPending
import com.beauty4you.admin.ui.theme.Tint
import java.time.LocalDate

// «Grafik pracy» мастера (item76, часть 2) — шторка поверх карточки мастера. Готового макета нет:
// неделя по дням в стиле карточек приложения, под ней — панель «применить к выбранным».
@Composable
fun ScheduleSheet(master: Master, onClose: () -> Unit) {
    val viewModel: ScheduleViewModel = viewModel(key = "schedule", factory = ScheduleViewModel.factory(appContainer()))
    val state by viewModel.state.collectAsState()
    LaunchedEffect(master.id) { viewModel.start(master) }
    DisposableEffect(Unit) { onDispose { viewModel.reset() } }
    LaunchedEffect(state.closed) { if (state.closed) onClose() }
    // Пока start() не отработал, в state может быть прошлый мастер — не показываем его график
    val ready = state.master?.id == master.id

    FormSheet(
        title = stringResource(R.string.schedule_title, master.name),
        busy = state.saving,
        dirty = ready && state.isDirty,
        onDismiss = onClose,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
            IconButton(onClick = viewModel::previousWeek, enabled = !state.saving) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = stringResource(R.string.calendar_prev_week), tint = Rose)
            }
            Text(
                PolishDates.weekRange(state.weekStart),
                style = B4UType.ItemTitleBold,
                color = Ink,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            IconButton(onClick = viewModel::nextWeek, enabled = !state.saving) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = stringResource(R.string.calendar_next_week), tint = Rose)
            }
        }

        when {
            !ready || state.loading -> SkeletonList(rows = 7, height = 44.dp, modifier = Modifier.padding(top = 6.dp))
            state.loadError -> ErrorState(onRetry = viewModel::retry, modifier = Modifier.padding(top = 6.dp))
            else -> {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    FieldLabel(R.string.schedule_days, top = 0.dp)
                    Box(Modifier.weight(1f))
                    Text(
                        stringResource(if (state.selected.containsAll(state.week)) R.string.schedule_unselect_week else R.string.schedule_select_week),
                        style = B4UType.BodyStrong,
                        color = Rose,
                        modifier = Modifier
                            .clip(FieldShape)
                            .clickable(enabled = !state.saving, onClick = viewModel::toggleWeek)
                            .padding(horizontal = 6.dp, vertical = 4.dp),
                    )
                }
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(FieldShape)
                        .background(CardBg)
                        .border(BorderStroke(1.dp, Border), FieldShape),
                ) {
                    state.week.forEach { date ->
                        DayRow(
                            date = date,
                            day = state.edited[date] ?: DaySchedule(DayStatus.UNSET),
                            selected = date in state.selected,
                            changed = date in state.changed,
                            enabled = !state.saving,
                            onToggle = { viewModel.toggleDay(date) },
                        )
                    }
                }
                FormHint(stringResource(R.string.schedule_hint))

                BulkPanel(state, viewModel)
            }
        }

        if (state.conflicts.isNotEmpty()) {
            ConflictsBlock(state.conflicts)
        }

        state.error?.let { FormErrorBanner(stringResource(it.messageRes())) }

        ScheduleButtons(state, viewModel)
    }
}

@Composable
private fun DayRow(date: LocalDate, day: DaySchedule, selected: Boolean, changed: Boolean, enabled: Boolean, onToggle: () -> Unit) {
    val today = LocalDate.now()
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .background(if (selected) Tint else Color.Transparent)
            .clickable(enabled = enabled, onClick = onToggle)
            .padding(start = 4.dp, end = 14.dp),
    ) {
        Checkbox(
            checked = selected,
            onCheckedChange = { onToggle() },
            enabled = enabled,
            colors = CheckboxDefaults.colors(checkedColor = Rose, uncheckedColor = MutedLight),
        )
        Text(
            "${PolishDates.weekdayShort(date)} ${PolishDates.shortDate(date, today)}",
            style = if (date == today) B4UType.ItemTitleBold else B4UType.ItemTitle,
            color = InkStrong,
            modifier = Modifier.weight(1f),
        )
        val (text, color) = when (day.status) {
            DayStatus.WORKING -> "${PolishDates.time(day.start)}–${PolishDates.time(day.end)}" to StatusConfirmed.fg
            DayStatus.OFF -> stringResource(R.string.schedule_day_off) to StatusPending.fg
            DayStatus.UNSET -> stringResource(R.string.schedule_day_unset) to MutedLight
        }
        Text(text, style = B4UType.BodyStrong, color = color)
        // Метка «изменено, ещё не сохранено»
        Box(
            Modifier
                .padding(start = 8.dp)
                .size(7.dp)
                .clip(CircleShape)
                .background(if (changed) Rose else Color.Transparent),
        )
    }
}

@Composable
private fun BulkPanel(state: ScheduleUiState, viewModel: ScheduleViewModel) {
    val count = state.selected.size
    val enabled = count > 0 && !state.saving
    FieldLabel(R.string.schedule_apply_label)
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        SelectChip(stringResource(R.string.schedule_working), selected = state.bulkWorking, enabled = enabled) { viewModel.setBulkWorking(true) }
        SelectChip(stringResource(R.string.schedule_day_off), selected = !state.bulkWorking, enabled = enabled) { viewModel.setBulkWorking(false) }
    }
    if (state.bulkWorking) {
        val options = ScheduleLogic.timeOptions()
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 8.dp)) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.schedule_from), style = B4UType.Label, color = Muted, modifier = Modifier.padding(bottom = 4.dp))
                TimeDropdown(state.bulkStart, options, enabled, viewModel::setBulkStart, error = state.hoursError != null)
            }
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.schedule_to), style = B4UType.Label, color = Muted, modifier = Modifier.padding(bottom = 4.dp))
                TimeDropdown(state.bulkEnd, options, enabled, viewModel::setBulkEnd, error = state.hoursError != null)
            }
        }
        state.hoursError?.let {
            Text(stringResource(it.messageRes()), style = B4UType.CaptionSmall, color = StatusCancelled.fg, modifier = Modifier.padding(top = 4.dp))
        }
    }
    Box(
        modifier = Modifier
            .padding(top = 10.dp)
            .fillMaxWidth()
            .clip(FieldShape)
            .background(CardBg)
            .border(BorderStroke(1.dp, if (enabled) Rose else Border), FieldShape)
            .clickable(enabled = enabled, onClick = viewModel::applyToSelected)
            .padding(vertical = 11.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            if (count == 0) stringResource(R.string.schedule_select_first) else pluralStringResource(R.plurals.schedule_apply, count, count),
            style = B4UType.ItemTitle,
            color = if (enabled) Rose else MutedLight,
        )
    }
}

// Записи на днях, которые станут выходными (ответ POST /master-schedules/conflicts)
@Composable
private fun ConflictsBlock(conflicts: List<ScheduleConflict>) {
    val today = LocalDate.now()
    Column(
        Modifier
            .padding(top = 14.dp)
            .fillMaxWidth()
            .clip(FieldShape)
            .background(StatusPending.bg)
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text(
            pluralStringResource(R.plurals.schedule_conflicts_title, conflicts.size, conflicts.size),
            style = B4UType.ItemTitleBold,
            color = StatusPending.fg,
        )
        conflicts.forEach { c ->
            Text(
                "${PolishDates.weekdayShort(c.date)} ${PolishDates.shortDate(c.date, today)}, ${PolishDates.time(c.start)} · ${c.clientName} · ${c.serviceName}",
                style = B4UType.Caption,
                color = InkStrong,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Text(stringResource(R.string.schedule_conflicts_hint), style = B4UType.CaptionSmall, color = Muted, modifier = Modifier.padding(top = 6.dp))
    }
}

// Обычно — «Zapisz»; при найденных конфликтах — «Wróć do edycji» / «Zapisz mimo to»
@Composable
private fun ScheduleButtons(state: ScheduleUiState, viewModel: ScheduleViewModel) {
    val hasConflicts = state.conflicts.isNotEmpty()
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 20.dp).fillMaxWidth()) {
        if (hasConflicts) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(FieldShape)
                    .background(CardBg)
                    .border(BorderStroke(1.dp, Border), FieldShape)
                    .clickable(enabled = !state.saving, onClick = viewModel::dismissConflicts)
                    .padding(vertical = 13.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(stringResource(R.string.discard_no), style = B4UType.ItemTitle, color = Ink)
            }
        }
        Box(
            modifier = Modifier
                .weight(if (hasConflicts) 1.4f else 1f)
                .clip(FieldShape)
                .background(if (state.saving) Rose.copy(alpha = 0.45f) else Rose)
                .clickable(enabled = !state.saving && !state.loading) {
                    if (hasConflicts) viewModel.confirmConflicts() else viewModel.save()
                }
                .padding(vertical = 13.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (state.saving) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
            } else {
                Text(
                    stringResource(if (hasConflicts) R.string.schedule_save_anyway else R.string.form_save),
                    style = B4UType.Button,
                    color = Color.White,
                )
            }
        }
    }
}

internal fun HoursError.messageRes(): Int = when (this) {
    HoursError.START_NOT_BEFORE_END -> R.string.hours_error_order
    HoursError.OUT_OF_RANGE -> R.string.hours_error_range
}

private fun ScheduleError.messageRes(): Int = when (this) {
    ScheduleError.VALIDATION -> R.string.error_validation
    ScheduleError.NOT_FOUND -> R.string.catalog_error_not_found
    ScheduleError.NETWORK -> R.string.error_network
    ScheduleError.UNKNOWN -> R.string.error_unknown
}
