package com.beauty4you.admin.ui.common

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beauty4you.admin.R
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

// Общие элементы форм-шторок item76 (мастер, услуга, категория) — в стиле существующих bottom
// sheet «Nowa wizyta» / «Nowy wpis»: подписи полей заглавными, кнопки «Usuń» / «Zapisz».

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormSheet(title: String, busy: Boolean, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    ModalBottomSheet(
        onDismissRequest = { if (!busy) onDismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
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
            Text(title, style = B4UType.SheetTitle, color = Ink)
            content()
        }
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
