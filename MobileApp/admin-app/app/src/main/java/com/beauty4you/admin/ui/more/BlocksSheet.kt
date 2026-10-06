package com.beauty4you.admin.ui.more

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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.BlockError
import com.beauty4you.admin.domain.BlockFieldError
import com.beauty4you.admin.domain.BlockReason
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.MasterBlock
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.domain.ScheduleLogic
import com.beauty4you.admin.ui.common.B4UDatePickerDialog
import com.beauty4you.admin.ui.common.ConfirmDeleteDialog
import com.beauty4you.admin.ui.common.DeleteSaveButtons
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.FormErrorBanner
import com.beauty4you.admin.ui.common.FormSheet
import com.beauty4you.admin.ui.common.OnSheetClosed
import com.beauty4you.admin.ui.common.FormTextField
import com.beauty4you.admin.ui.common.PillAction
import com.beauty4you.admin.ui.common.SelectChip
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.TimeDropdown
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.form.FieldLabel
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.StatusCancelled
import java.time.LocalDate

// «Blokady» мастера (item76, часть 2) — шторка поверх карточки мастера: будущие блокировки,
// «Dodaj blokadę» открывает форму (ещё одна шторка), у каждой — удаление с подтверждением.
@Composable
fun BlocksSheet(master: Master, onClose: () -> Unit) {
    val viewModel: BlocksViewModel = viewModel(key = "blocks", factory = BlocksViewModel.factory(appContainer()))
    val state by viewModel.state.collectAsState()
    // После пересоздания Activity start() для того же мастера ничего не делает — форма блокировки остаётся
    LaunchedEffect(master.id) { viewModel.start(master) }
    OnSheetClosed(viewModel::reset)
    val ready = state.master?.id == master.id

    // Список — не форма: изменений, которые можно потерять, в нём нет
    FormSheet(
        title = stringResource(R.string.blocks_title, master.name),
        busy = state.deleting,
        dirty = false,
        onDismiss = onClose,
    ) {
        when {
            !ready || state.loading -> SkeletonList(rows = 3, height = 52.dp, modifier = Modifier.padding(top = 12.dp))
            state.loadError -> ErrorState(onRetry = viewModel::load, modifier = Modifier.padding(top = 12.dp))
            state.blocks.isEmpty() -> Text(
                stringResource(R.string.blocks_empty),
                style = B4UType.Caption,
                color = Muted,
                modifier = Modifier.padding(top = 14.dp),
            )
            else -> Column(
                Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .clip(FieldShape)
                    .background(CardBg)
                    .border(BorderStroke(1.dp, Border), FieldShape),
            ) {
                state.blocks.forEach { block ->
                    BlockRow(block, enabled = !state.deleting, onDelete = { viewModel.askDelete(block) })
                }
            }
        }

        state.error?.let { FormErrorBanner(stringResource(it.messageRes())) }

        Row(Modifier.padding(top = 14.dp)) {
            PillAction(Icons.Filled.Add, stringResource(R.string.blocks_add), enabled = ready && !state.deleting, onClick = viewModel::openNew)
        }
    }

    state.confirmDelete?.let { block ->
        ConfirmDeleteDialog(
            title = stringResource(R.string.block_delete_confirm_title),
            text = stringResource(R.string.block_delete_confirm_text, blockPeriod(block)),
            confirmLabel = stringResource(R.string.block_delete_confirm_yes),
            onConfirm = viewModel::confirmDelete,
            onDismiss = viewModel::dismissDelete,
        )
    }

    state.editor?.let { BlockFormSheet(it, viewModel) }
}

@Composable
private fun BlockRow(block: MasterBlock, enabled: Boolean, onDelete: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(start = 14.dp, end = 4.dp, top = 4.dp, bottom = 4.dp)) {
        Column(Modifier.weight(1f)) {
            Text(blockPeriod(block), style = B4UType.ItemTitle, color = InkStrong)
            Text(
                block.reason ?: stringResource(R.string.calendar_block),
                style = B4UType.CaptionSmall,
                color = Muted,
            )
        }
        IconButton(onClick = onDelete, enabled = enabled) {
            Icon(Icons.Outlined.Delete, contentDescription = stringResource(R.string.form_delete), tint = if (enabled) StatusCancelled.fg else MutedLight)
        }
    }
}

// «Wt 7 paź, 10:00–12:00»; многодневная (отпуск из веб-CRM) — «7 paź 10:00 – 9 paź 19:00»
private fun blockPeriod(block: MasterBlock): String {
    val today = LocalDate.now()
    val startDate = block.start.toLocalDate()
    val endDate = block.end.toLocalDate()
    return if (startDate == endDate) {
        "${PolishDates.weekdayShort(startDate)} ${PolishDates.shortDate(startDate, today)}, " +
            "${PolishDates.time(block.start.toLocalTime())}–${PolishDates.time(block.end.toLocalTime())}"
    } else {
        "${PolishDates.shortDate(startDate, today)} ${PolishDates.time(block.start.toLocalTime())} – " +
            "${PolishDates.shortDate(endDate, today)} ${PolishDates.time(block.end.toLocalTime())}"
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BlockFormSheet(editor: BlockEditorState, viewModel: BlocksViewModel) {
    val form = editor.form
    val errors = editor.visibleFieldErrors
    val enabled = !editor.saving
    var showDatePicker by rememberSaveable { mutableStateOf(false) }

    FormSheet(
        title = stringResource(R.string.block_form_title),
        busy = editor.saving,
        dirty = editor.isDirty,
        onDismiss = viewModel::closeEditor,
    ) {
        FieldLabel(R.string.block_form_date, top = 14.dp)
        Box(
            Modifier
                .fillMaxWidth()
                .clip(FieldShape)
                .background(CardBg)
                .border(BorderStroke(1.dp, if (BlockFieldError.DATE_IN_PAST in errors) StatusCancelled.fg else Border), FieldShape)
                .clickable(enabled = enabled) { showDatePicker = true }
                .padding(horizontal = 14.dp, vertical = 11.dp),
        ) {
            Text(PolishDates.longDate(form.date), style = B4UType.ItemTitle, color = InkStrong)
        }
        if (BlockFieldError.DATE_IN_PAST in errors) ErrorText(R.string.block_error_past)

        val options = ScheduleLogic.timeOptions()
        val hoursError = BlockFieldError.START_NOT_BEFORE_END in errors || BlockFieldError.OUT_OF_RANGE in errors
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                FieldLabel(R.string.block_form_from)
                TimeDropdown(form.start, options, enabled, viewModel::setStart, error = hoursError)
            }
            Column(Modifier.weight(1f)) {
                FieldLabel(R.string.block_form_to)
                TimeDropdown(form.end, options, enabled, viewModel::setEnd, error = hoursError)
            }
        }
        when {
            BlockFieldError.START_NOT_BEFORE_END in errors -> ErrorText(R.string.hours_error_order)
            BlockFieldError.OUT_OF_RANGE in errors -> ErrorText(R.string.hours_error_range)
        }

        FieldLabel(R.string.block_form_reason)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            BlockReason.entries.forEach { reason ->
                SelectChip(stringResource(reason.labelRes()), selected = form.reason == reason, enabled = enabled) { viewModel.setReason(reason) }
            }
        }

        FieldLabel(R.string.block_form_comment)
        FormTextField(
            value = form.comment,
            onValueChange = viewModel::setComment,
            error = when {
                BlockFieldError.COMMENT_REQUIRED in errors -> stringResource(R.string.block_error_comment)
                BlockFieldError.COMMENT_TOO_LONG in errors -> stringResource(R.string.block_error_comment_long)
                else -> null
            },
            enabled = enabled,
        )

        editor.error?.let { FormErrorBanner(stringResource(it.messageRes())) }

        DeleteSaveButtons(showDelete = false, busy = editor.saving, saving = editor.saving, onDelete = {}, onSave = viewModel::save)
    }

    if (showDatePicker) {
        B4UDatePickerDialog(initial = form.date, onPick = viewModel::setDate, onDismiss = { showDatePicker = false })
    }
}

@Composable
private fun ErrorText(text: Int) {
    Text(stringResource(text), style = B4UType.CaptionSmall, color = StatusCancelled.fg, modifier = Modifier.padding(top = 4.dp))
}

private fun BlockReason.labelRes(): Int = when (this) {
    BlockReason.URLOP -> R.string.block_reason_urlop
    BlockReason.PRZERWA -> R.string.block_reason_przerwa
    BlockReason.INNE -> R.string.block_reason_inne
}

private fun BlockError.messageRes(): Int = when (this) {
    BlockError.OVERLAPS_BOOKING -> R.string.block_error_overlaps_booking
    BlockError.OVERLAPS_BLOCK -> R.string.block_error_overlaps_block
    BlockError.VALIDATION -> R.string.error_validation
    BlockError.NOT_FOUND -> R.string.catalog_error_not_found
    BlockError.NETWORK -> R.string.error_network
    BlockError.UNKNOWN -> R.string.error_unknown
}
