package com.beauty4you.admin.ui.more

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.beauty4you.admin.R
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.CatalogEditLogic
import com.beauty4you.admin.domain.MasterFieldError
import com.beauty4you.admin.ui.common.ColorDot
import com.beauty4you.admin.ui.common.DeleteSaveButtons
import com.beauty4you.admin.ui.common.FormErrorBanner
import com.beauty4you.admin.ui.common.FormHint
import com.beauty4you.admin.ui.common.FormSheet
import com.beauty4you.admin.ui.common.FormTextField
import com.beauty4you.admin.ui.common.MasterPhoto
import com.beauty4you.admin.ui.common.PillAction
import com.beauty4you.admin.ui.common.SelectChip
import com.beauty4you.admin.ui.form.FieldLabel
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.StatusCancelled
import com.beauty4you.admin.ui.theme.StatusConfirmed
import com.beauty4you.admin.ui.theme.StatusDone
import com.beauty4you.admin.ui.theme.masterColor
import java.io.File

// Карточка мастера «Nowy mistrz / Edytuj mistrza» (item76): фото, имя, цвет, специализации,
// услуги, активность. Готового макета нет — в стиле формы «Nowy wpis».
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MasterFormSheet(editor: MasterEditorState, catalog: Catalog, viewModel: CatalogEditViewModel) {
    val context = LocalContext.current
    val form = editor.form
    val errors = editor.visibleFieldErrors
    val enabled = !editor.saving

    // Uri снимка переживает поворот экрана и пересоздание Activity камерой
    var cameraUri by rememberSaveable { mutableStateOf<Uri?>(null) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val uri = cameraUri
        if (saved && uri != null) viewModel.onMasterPhotoPicked(uri)
    }
    val hasCamera = remember { context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.onMasterPhotoPicked(uri)
    }

    FormSheet(
        title = stringResource(if (editor.isEdit) R.string.master_form_title_edit else R.string.master_form_title_new),
        busy = editor.saving,
        dirty = editor.isDirty,
        onDismiss = viewModel::closeMaster,
    ) {
        FieldLabel(R.string.master_form_photo, top = 14.dp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(contentAlignment = Alignment.Center) {
                MasterPhoto(form.photo.preview, size = 64.dp)
                if (editor.encodingPhoto) {
                    Box(Modifier.size(64.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.6f)), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Rose, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    }
                }
            }
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(start = 14.dp).weight(1f),
            ) {
                // Без камеры кнопку не показываем; сбой запуска камеры — тост вместо падения (как в item75-fix)
                if (hasCamera) {
                    PillAction(Icons.Filled.PhotoCamera, stringResource(R.string.news_form_camera), enabled = !editor.busy) {
                        try {
                            val uri = newCameraUri(context)
                            cameraUri = uri
                            takePicture.launch(uri)
                        } catch (e: ActivityNotFoundException) {
                            showCameraUnavailable(context)
                        } catch (e: SecurityException) {
                            showCameraUnavailable(context)
                        }
                    }
                }
                PillAction(Icons.Filled.PhotoLibrary, stringResource(R.string.news_form_gallery), enabled = !editor.busy) {
                    pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }
                if (form.photo.preview != null) {
                    PillAction(null, stringResource(R.string.news_form_remove_photo), enabled = !editor.busy, color = StatusCancelled.fg, onClick = viewModel::removeMasterPhoto)
                }
            }
        }

        // График и блокировки — только у уже сохранённого мастера (нужен его id)
        editor.original?.let { saved ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 12.dp)) {
                PillAction(Icons.Filled.CalendarMonth, stringResource(R.string.schedule_open), enabled = !editor.busy) { viewModel.openSchedule(saved) }
                PillAction(Icons.Filled.Block, stringResource(R.string.blocks_open), enabled = !editor.busy) { viewModel.openBlocks(saved) }
            }
        }

        FieldLabel(R.string.master_form_name)
        FormTextField(
            value = form.name,
            onValueChange = viewModel::setMasterName,
            error = if (MasterFieldError.NAME_EMPTY in errors) stringResource(R.string.master_error_name) else null,
            enabled = enabled,
            capitalization = KeyboardCapitalization.Words,
        )

        // Цвет мастера нигде не хранится: веб-CRM и все приложения вычисляют его из id
        // (MasterColors) — поэтому здесь только показываем, выбрать другой нельзя
        FieldLabel(R.string.master_form_color)
        Row(verticalAlignment = Alignment.CenterVertically) {
            val original = editor.original
            if (original != null) {
                ColorDot(masterColor(original.id), size = 14.dp)
                Text(
                    stringResource(R.string.master_color_auto),
                    style = B4UType.Caption,
                    color = Muted,
                    modifier = Modifier.padding(start = 8.dp),
                )
            } else {
                Text(stringResource(R.string.master_color_after_save), style = B4UType.Caption, color = Muted)
            }
        }

        FieldLabel(R.string.master_form_specialization)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            catalog.categories.sortedBy { it.name.lowercase() }.forEach { category ->
                SelectChip(
                    label = category.name,
                    selected = category.id in form.categoryIds,
                    enabled = enabled,
                    onClick = { viewModel.toggleSpecialization(category.id) },
                )
            }
        }
        if (MasterFieldError.NO_SPECIALIZATION in errors) {
            Text(stringResource(R.string.master_error_specialization), style = B4UType.CaptionSmall, color = StatusCancelled.fg, modifier = Modifier.padding(top = 4.dp))
        }

        FieldLabel(R.string.master_form_services)
        MasterServicesList(catalog, form.serviceIds, enabled, viewModel::toggleMasterService)

        if (editor.isEdit) {
            FieldLabel(R.string.master_form_status)
            val colors = if (form.isActive) StatusConfirmed else StatusDone
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(FieldShape)
                    .background(colors.bg)
                    .border(BorderStroke(1.dp, Border), FieldShape)
                    .clickable(enabled = enabled, onClick = viewModel::toggleMasterActive)
                    .padding(horizontal = 14.dp, vertical = 11.dp),
            ) {
                Text(
                    stringResource(
                        R.string.news_form_status_hint,
                        stringResource(if (form.isActive) R.string.master_active else R.string.masters_inactive),
                    ),
                    style = B4UType.ItemTitle,
                    color = colors.fg,
                )
            }
            FormHint(stringResource(R.string.master_inactive_hint))
        }

        editor.error?.let { FormErrorBanner(stringResource(it.messageRes())) }

        // «Usuń» мастера скрыто до item80: DELETE /staff всегда отвечает 409 (обязательная
        // специализация без каскада) — вывести мастера из работы можно статусом «Nieaktywny»
        DeleteSaveButtons(
            showDelete = false,
            busy = editor.busy,
            saving = editor.saving,
            onDelete = {},
            onSave = viewModel::saveMaster,
        )
    }
}

// Услуги мастера галочками, сгруппированные по категориям (как список «Usługi»)
@Composable
private fun MasterServicesList(catalog: Catalog, selected: Set<String>, enabled: Boolean, onToggle: (String) -> Unit) {
    val groups = CatalogEditLogic.groupServices(catalog.categories, catalog.services).filter { it.second.isNotEmpty() }
    if (groups.isEmpty()) {
        Text(stringResource(R.string.master_no_services), style = B4UType.Caption, color = Muted)
        return
    }
    val otherLabel = stringResource(R.string.services_other)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(FieldShape)
            .background(CardBg)
            .border(BorderStroke(1.dp, Border), FieldShape)
            .padding(vertical = 4.dp),
    ) {
        groups.forEach { (category, services) ->
            Text(
                (category?.name ?: otherLabel).uppercase(),
                style = B4UType.Pill.copy(letterSpacing = 0.4.sp),
                color = MutedLight,
                modifier = Modifier.padding(start = 14.dp, top = 8.dp, bottom = 2.dp),
            )
            services.forEach { service ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = enabled) { onToggle(service.id) }
                        .padding(start = 4.dp, end = 14.dp),
                ) {
                    Checkbox(
                        checked = service.id in selected,
                        onCheckedChange = { onToggle(service.id) },
                        enabled = enabled,
                        colors = CheckboxDefaults.colors(checkedColor = Rose, uncheckedColor = MutedLight),
                    )
                    Text(service.name, style = B4UType.ItemTitle, color = InkStrong, modifier = Modifier.weight(1f))
                    Text(stringResource(R.string.services_duration, service.durationMin), style = B4UType.CaptionSmall, color = Muted)
                }
            }
        }
    }
}

// Обычный Android-тост: тосты приложения рисуются в MainScaffold под открытым bottom sheet и не видны
private fun showCameraUnavailable(context: Context) {
    Toast.makeText(context, R.string.news_camera_unavailable, Toast.LENGTH_SHORT).show()
}

// Файл для снимка камеры — в кэше приложения, отдаётся камере через FileProvider
private fun newCameraUri(context: Context): Uri {
    val dir = File(context.cacheDir, "master_camera").apply { mkdirs() }
    val file = File(dir, "master_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}
