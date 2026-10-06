package com.beauty4you.admin.ui.news

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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.NewsError
import com.beauty4you.admin.domain.NewsFieldError
import com.beauty4you.admin.domain.NewsFormLogic
import com.beauty4you.admin.ui.common.ConfirmDeleteDialog
import com.beauty4you.admin.ui.common.DeleteSaveButtons
import com.beauty4you.admin.ui.common.FormErrorBanner
import com.beauty4you.admin.ui.common.FormSheet
import com.beauty4you.admin.ui.common.PillAction
import com.beauty4you.admin.ui.form.FieldLabel
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.StatusCancelled
import java.io.File

// Форма «Nowy wpis / Edytuj wpis» — NEWS FORM SHEET из дизайна «B4U Admin App»
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsFormSheet(editor: NewsEditorState, viewModel: NewsViewModel) {
    val context = LocalContext.current
    val form = editor.form
    val errors = editor.visibleFieldErrors

    // Uri снимка переживает поворот экрана и пересоздание Activity камерой
    var cameraUri by rememberSaveable { mutableStateOf<Uri?>(null) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val uri = cameraUri
        if (saved && uri != null) viewModel.onImagePicked(uri)
    }
    val hasCamera = remember { context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.onImagePicked(uri)
    }

    FormSheet(
        title = stringResource(if (editor.isEdit) R.string.news_form_title_edit else R.string.news_form_title_new),
        busy = editor.saving,
        dirty = editor.isDirty,
        onDismiss = viewModel::close,
    ) {
        FieldLabel(R.string.news_form_photo, top = 14.dp)
        Box(
            Modifier
                .fillMaxWidth()
                .height(130.dp)
                .clip(FieldShape)
                .border(BorderStroke(1.dp, Border), FieldShape),
        ) {
            NewsImageBox(form.image.preview, Modifier.fillMaxSize())
            if (editor.encodingImage) {
                Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = 0.6f)), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Rose, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 8.dp)) {
            // Без камеры кнопку не показываем; если камера есть, но запуск всё же не удался
            // (нет приложения камеры, запрет политикой устройства) — тост вместо падения (item75-fix)
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
            if (form.image.preview != null) {
                PillAction(null, stringResource(R.string.news_form_remove_photo), enabled = !editor.busy, color = StatusCancelled.fg, onClick = viewModel::removeImage)
            }
        }

        FieldLabel(R.string.news_form_category)
        FieldBox(onClick = viewModel::cycleCategory, enabled = !editor.saving) {
            Text(stringResource(form.category.labelRes()), style = B4UType.ItemTitle, color = InkStrong)
        }

        FieldLabel(R.string.news_form_title)
        NewsTextField(
            value = form.title,
            onValueChange = viewModel::setTitle,
            max = NewsFormLogic.TITLE_MAX,
            error = errors.firstTitleError(),
            singleLine = true,
            textStyle = B4UType.ItemTitle.copy(color = InkStrong),
            enabled = !editor.saving,
        )

        FieldLabel(R.string.news_form_body)
        NewsTextField(
            value = form.body,
            onValueChange = viewModel::setBody,
            max = NewsFormLogic.BODY_MAX,
            error = errors.firstBodyError(),
            singleLine = false,
            minHeight = 70.dp,
            textStyle = B4UType.Body.copy(color = InkStrong, lineHeight = 18.sp),
            enabled = !editor.saving,
        )

        FieldLabel(R.string.news_form_status)
        val statusColors = form.status.colors()
        FieldBox(onClick = viewModel::toggleStatus, enabled = !editor.saving, background = statusColors.bg) {
            Text(
                stringResource(R.string.news_form_status_hint, stringResource(form.status.labelRes())),
                style = B4UType.ItemTitle,
                color = statusColors.fg,
            )
        }

        editor.error?.let { FormErrorBanner(stringResource(it.messageRes())) }

        DeleteSaveButtons(
            showDelete = editor.isEdit,
            busy = editor.busy,
            saving = editor.saving,
            onDelete = viewModel::askDelete,
            onSave = viewModel::save,
        )
    }

    if (editor.confirmDelete) {
        ConfirmDeleteDialog(
            title = stringResource(R.string.news_delete_confirm_title),
            text = stringResource(R.string.news_delete_confirm_text),
            confirmLabel = stringResource(R.string.news_delete_confirm_yes),
            onConfirm = viewModel::confirmDelete,
            onDismiss = viewModel::dismissDelete,
        )
    }
}

// Обычный Android-тост: тосты приложения рисуются в MainScaffold под открытым bottom sheet и не видны
private fun showCameraUnavailable(context: Context) {
    Toast.makeText(context, R.string.news_camera_unavailable, Toast.LENGTH_SHORT).show()
}

// Файл для снимка камеры — в кэше приложения, отдаётся камере через FileProvider
private fun newCameraUri(context: Context): Uri {
    val dir = File(context.cacheDir, "news_camera").apply { mkdirs() }
    val file = File(dir, "news_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

@Composable
private fun FieldBox(
    onClick: () -> Unit,
    enabled: Boolean,
    background: Color = CardBg,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(FieldShape)
            .background(background)
            .border(BorderStroke(1.dp, Border), FieldShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
    ) { content() }
}

// Поле ввода в стиле дизайна (рамка F0E1E2, радиус 12, отступы 11/14) — OutlinedTextField выше макета
@Composable
private fun NewsTextField(
    value: String,
    onValueChange: (String) -> Unit,
    max: Int,
    error: Int?,
    singleLine: Boolean,
    textStyle: TextStyle,
    enabled: Boolean,
    minHeight: Dp = 0.dp,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        singleLine = singleLine,
        textStyle = textStyle,
        cursorBrush = SolidColor(Rose),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = minHeight)
            .clip(FieldShape)
            .background(CardBg)
            .border(BorderStroke(1.dp, if (error != null) StatusCancelled.fg else Border), FieldShape)
            .padding(horizontal = 14.dp, vertical = 11.dp),
    )
    Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
        Text(
            error?.let { stringResource(it) }.orEmpty(),
            style = B4UType.CaptionSmall,
            color = StatusCancelled.fg,
            modifier = Modifier.weight(1f),
        )
        val length = value.trim().length
        Text(
            stringResource(R.string.news_form_counter, length, max),
            style = B4UType.CaptionSmall,
            color = if (length > max) StatusCancelled.fg else Muted,
            textAlign = TextAlign.End,
        )
    }
}

private fun Set<NewsFieldError>.firstTitleError(): Int? = when {
    NewsFieldError.TITLE_EMPTY in this -> R.string.news_error_title_empty
    NewsFieldError.TITLE_TOO_LONG in this -> R.string.news_error_title_long
    else -> null
}

private fun Set<NewsFieldError>.firstBodyError(): Int? = when {
    NewsFieldError.BODY_EMPTY in this -> R.string.news_error_body_empty
    NewsFieldError.BODY_TOO_LONG in this -> R.string.news_error_body_long
    else -> null
}

private fun NewsError.messageRes(): Int = when (this) {
    NewsError.IMAGE_INVALID -> R.string.news_error_image
    NewsError.VALIDATION -> R.string.news_error_validation
    NewsError.NOT_FOUND -> R.string.news_error_not_found
    NewsError.NETWORK -> R.string.error_network
    NewsError.UNKNOWN -> R.string.error_unknown
}
