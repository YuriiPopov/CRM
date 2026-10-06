package com.beauty4you.admin.ui.common

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.DangerBorder
import com.beauty4you.admin.ui.theme.DashedBorder
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.PillShape
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.SheetBackground
import com.beauty4you.admin.ui.theme.SheetShape
import com.beauty4you.admin.ui.theme.StatusCancelled
import com.beauty4you.admin.ui.theme.Tint
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import kotlinx.coroutines.launch

// Общие элементы форм-шторок item76 (мастер, услуга, категория) — в стиле существующих bottom
// sheet «Nowa wizyta» / «Nowy wpis»: подписи полей заглавными, кнопки «Usuń» / «Zapisz».

// Шторка формы. dirty — есть несохранённые изменения: тогда свайп вниз, «назад» и тап мимо формы
// не закрывают её сразу, а спрашивают «Odrzucić zmiany?» (item76). Пустая/нетронутая форма
// закрывается без вопроса. Пока идёт сохранение (busy), закрыть шторку нельзя вовсе.
// title == null — заголовок рисует сама форма (у формы визита в нём ещё пометка «Online»).
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormSheet(
    title: String?,
    busy: Boolean,
    dirty: Boolean,
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val scope = rememberCoroutineScope()
    var askDiscard by remember { mutableStateOf(false) }
    // Выбрано «Odrzuć» — дальше шторка закрывается без проверок
    var discarding by remember { mutableStateOf(false) }
    val currentDirty by rememberUpdatedState(dirty)
    val currentBusy by rememberUpdatedState(busy)
    // confirmValueChange проверяется перед закрытием свайпом и тапом по затемнению — false оставляет
    // шторку открытой. «Назад» ModalBottomSheet закрывает в обход этой проверки — его ловит
    // BackHandler ниже (он зарегистрирован позже обработчика диалога и срабатывает первым).
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
        confirmValueChange = { target ->
            when {
                target != SheetValue.Hidden || discarding -> true
                currentBusy -> false
                currentDirty -> {
                    askDiscard = true
                    false
                }
                else -> true
            }
        },
    )

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
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp)
                .navigationBarsPadding(),
        ) {
            BackHandler {
                when {
                    currentBusy -> Unit
                    currentDirty -> askDiscard = true
                    else -> scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() }
                }
            }
            if (title != null) Text(title, style = B4UType.SheetTitle, color = Ink)
            content()
        }
    }

    if (askDiscard) {
        AlertDialog(
            onDismissRequest = { askDiscard = false },
            title = { Text(stringResource(R.string.discard_title), style = B4UType.SheetTitle, color = Ink) },
            text = { Text(stringResource(R.string.discard_text), style = B4UType.Body, color = Muted) },
            confirmButton = {
                TextButton(onClick = {
                    askDiscard = false
                    discarding = true
                    scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() }
                }) {
                    Text(stringResource(R.string.discard_yes), color = StatusCancelled.fg, style = B4UType.Button)
                }
            },
            dismissButton = {
                TextButton(onClick = { askDiscard = false }) {
                    Text(stringResource(R.string.discard_no), color = Muted)
                }
            },
            containerColor = SheetBackground,
        )
    }
}

// Поле ввода в стиле дизайна (рамка F0E1E2, радиус 12, отступы 11/14); ошибка — под полем
@Composable
fun FormTextField(
    value: String,
    onValueChange: (String) -> Unit,
    error: String?,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.Sentences,
    suffix: String? = null,
) {
    Column(modifier) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(FieldShape)
                .background(CardBg)
                .border(BorderStroke(1.dp, if (error != null) StatusCancelled.fg else Border), FieldShape)
                .padding(horizontal = 14.dp, vertical = 11.dp),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                singleLine = true,
                textStyle = B4UType.ItemTitle.copy(color = InkStrong),
                cursorBrush = SolidColor(Rose),
                keyboardOptions = KeyboardOptions(capitalization = capitalization, keyboardType = keyboardType),
                modifier = Modifier.weight(1f),
            )
            if (suffix != null) Text(suffix, style = B4UType.ItemTitle, color = Muted, modifier = Modifier.padding(start = 6.dp))
        }
        if (error != null) {
            Text(error, style = B4UType.CaptionSmall, color = StatusCancelled.fg, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

// Ошибка бэкенда/сохранения — плашка над кнопками, форма остаётся открытой
@Composable
fun FormErrorBanner(text: String) {
    Text(
        text,
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

@Composable
fun FormHint(text: String, modifier: Modifier = Modifier) {
    Text(text, style = B4UType.CaptionSmall, color = Muted, modifier = modifier.padding(top = 4.dp))
}

// «Usuń» (только для существующей записи) + «Zapisz»
@Composable
fun DeleteSaveButtons(
    showDelete: Boolean,
    busy: Boolean,
    saving: Boolean,
    onDelete: () -> Unit,
    onSave: () -> Unit,
    deleteEnabled: Boolean = true,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 20.dp).fillMaxWidth()) {
        if (showDelete) {
            val enabled = !busy && deleteEnabled
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(FieldShape)
                    .background(CardBg)
                    .border(BorderStroke(1.dp, if (enabled) DangerBorder else Border), FieldShape)
                    .clickable(enabled = enabled, onClick = onDelete)
                    .padding(vertical = 13.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    stringResource(R.string.form_delete),
                    style = B4UType.ItemTitle,
                    color = if (enabled) StatusCancelled.fg else MutedLight,
                )
            }
        }
        Box(
            modifier = Modifier
                .weight(2f)
                .clip(FieldShape)
                .background(if (busy) Rose.copy(alpha = 0.45f) else Rose)
                .clickable(enabled = !busy, onClick = onSave)
                .padding(vertical = 13.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (saving) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
            } else {
                Text(stringResource(R.string.form_save), style = B4UType.Button, color = Color.White)
            }
        }
    }
}

@Composable
fun ConfirmDeleteDialog(title: String, text: String, confirmLabel: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, style = B4UType.SheetTitle, color = Ink) },
        text = { Text(text, style = B4UType.Body, color = Muted) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirmLabel, color = StatusCancelled.fg, style = B4UType.Button)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.form_pick_date_cancel), color = Muted)
            }
        },
        containerColor = SheetBackground,
    )
}

// Чип выбора (специализация, категория услуги): выбранный — розовая заливка и галочка
@Composable
fun SelectChip(label: String, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(PillShape)
            .background(if (selected) Tint else CardBg)
            .border(BorderStroke(1.dp, if (selected) Rose else Border), PillShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
    ) {
        if (selected) Icon(Icons.Filled.Check, contentDescription = null, tint = Rose, modifier = Modifier.size(14.dp).padding(end = 2.dp))
        Text(label, style = B4UType.BodyStrong, color = if (selected) Ink else Muted)
    }
}

// Пилюля-действие под фото («Aparat», «Galeria», «Usuń zdjęcie») — как в форме новости
@Composable
fun PillAction(icon: ImageVector?, label: String, enabled: Boolean, color: Color = Ink, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(PillShape)
            .background(CardBg)
            .border(BorderStroke(1.dp, Border), PillShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = Rose, modifier = Modifier.size(16.dp).padding(end = 2.dp))
        Text(label, style = B4UType.BodyStrong, color = color, modifier = Modifier.padding(start = if (icon != null) 4.dp else 0.dp))
    }
}

// Выбор времени из списка (шаг 15 минут) — поле в стиле формы с выпадающим меню
@Composable
fun TimeDropdown(
    value: LocalTime,
    options: List<LocalTime>,
    enabled: Boolean,
    onSelect: (LocalTime) -> Unit,
    modifier: Modifier = Modifier,
    error: Boolean = false,
) {
    var expanded by remember { mutableStateOf(false) }
    // Меню открывается на текущем значении (а не на 06:00) — две строки выше него видны
    val scrollState = rememberScrollState()
    val itemPx = with(LocalDensity.current) { 48.dp.roundToPx() }
    LaunchedEffect(expanded) {
        if (expanded) scrollState.scrollTo((options.indexOf(value) - 2).coerceAtLeast(0) * itemPx)
    }
    Box(modifier) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(FieldShape)
                .background(CardBg)
                .border(BorderStroke(1.dp, if (error) StatusCancelled.fg else Border), FieldShape)
                .clickable(enabled = enabled) { expanded = true }
                .padding(horizontal = 14.dp, vertical = 11.dp),
        ) {
            Text(PolishDates.time(value), style = B4UType.ItemTitle, color = InkStrong, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = MutedLight)
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = CardBg,
            scrollState = scrollState,
            modifier = Modifier.heightIn(max = 280.dp),
        ) {
            options.forEach { time ->
                DropdownMenuItem(
                    text = { Text(PolishDates.time(time), style = B4UType.ItemTitle, color = if (time == value) Rose else InkStrong) },
                    onClick = {
                        expanded = false
                        onSelect(time)
                    },
                )
            }
        }
    }
}

// Диалог выбора даты в цветах приложения (как в форме визита)
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun B4UDatePickerDialog(initial: LocalDate, onPick: (LocalDate) -> Unit, onDismiss: () -> Unit) {
    val pickerState = rememberDatePickerState(
        initialSelectedDateMillis = initial.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                pickerState.selectedDateMillis?.let { onPick(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                onDismiss()
            }) { Text(stringResource(R.string.form_pick_date_ok), color = Rose) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.form_pick_date_cancel), color = Muted) }
        },
    ) {
        DatePicker(
            state = pickerState,
            showModeToggle = false,
            colors = DatePickerDefaults.colors(selectedDayContainerColor = Rose, todayDateBorderColor = Rose, todayContentColor = Rose),
        )
    }
}
