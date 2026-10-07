package com.beauty4you.admin.ui.more

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.beauty4you.admin.R
import com.beauty4you.admin.data.DecodedImages
import com.beauty4you.admin.domain.ServicePhotoDraft
import com.beauty4you.admin.domain.ServicePhotosLogic
import com.beauty4you.admin.ui.common.FormHint
import com.beauty4you.admin.ui.form.FieldLabel
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.StatusCancelled
import com.beauty4you.admin.ui.theme.Tint

private val ThumbSize = 84.dp

// Блок «Zdjęcia» в форме услуги (item84): до 5 фото из галереи, первое — «Okładka». Изменения копятся
// в форме и уходят на сервер по «Zapisz», незакрытая шторка с правками спросит «Odrzucić zmiany?».
@Composable
fun ServicePhotosSection(editor: ServiceEditorState, viewModel: CatalogEditViewModel) {
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.onServicePhotoPicked(uri)
    }
    val photos = editor.photos

    FieldLabel(R.string.service_photos_label)
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
    ) {
        photos.forEachIndexed { index, photo ->
            PhotoTile(
                photo = photo,
                isCover = index == 0,
                canMoveLeft = editor.photosEditable && index > 0,
                canMoveRight = editor.photosEditable && index < photos.lastIndex,
                canRemove = editor.photosEditable,
                onMove = { delta -> viewModel.moveServicePhoto(photo.key, delta) },
                onRemove = { viewModel.removeServicePhoto(photo.key) },
            )
        }
        if (ServicePhotosLogic.canAdd(photos.size)) {
            AddTile(
                loading = editor.photosLoading || editor.encodingPhoto,
                enabled = editor.canAddPhoto,
                onClick = { pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            )
        }
    }
    FormHint(
        if (ServicePhotosLogic.canAdd(photos.size)) {
            stringResource(R.string.service_photos_hint, photos.size, ServicePhotosLogic.MAX_PHOTOS)
        } else {
            stringResource(R.string.service_photos_limit, ServicePhotosLogic.MAX_PHOTOS)
        },
    )
}

@Composable
private fun PhotoTile(
    photo: ServicePhotoDraft,
    isCover: Boolean,
    canMoveLeft: Boolean,
    canMoveRight: Boolean,
    canRemove: Boolean,
    onMove: (Int) -> Unit,
    onRemove: () -> Unit,
) {
    val moveLeft = stringResource(R.string.service_photos_move_left)
    val moveRight = stringResource(R.string.service_photos_move_right)
    val remove = stringResource(R.string.service_photos_remove)
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(ThumbSize).clip(FieldShape).border(BorderStroke(1.dp, Border), FieldShape).background(Tint)) {
            Thumb(photo.dataUrl, Modifier.size(ThumbSize))
            if (isCover) {
                Text(
                    stringResource(R.string.service_photos_cover),
                    style = B4UType.Pill,
                    color = Color.White,
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(4.dp)
                        .clip(FieldShape)
                        .background(Color.Black.copy(alpha = 0.55f))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(3.dp)
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.55f))
                    .clickable(enabled = canRemove, onClick = onRemove)
                    .semantics { contentDescription = remove },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Close, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
            }
        }
        Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ArrowButton(Icons.AutoMirrored.Filled.KeyboardArrowLeft, moveLeft, canMoveLeft) { onMove(-1) }
            ArrowButton(Icons.AutoMirrored.Filled.KeyboardArrowRight, moveRight, canMoveRight) { onMove(1) }
        }
    }
}

@Composable
private fun ArrowButton(icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(30.dp)
            .clip(CircleShape)
            .background(CardBg)
            .border(BorderStroke(1.dp, Border), CircleShape)
            .clickable(enabled = enabled, onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = if (enabled) Muted else Border, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun AddTile(loading: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(ThumbSize)
            .clip(FieldShape)
            .background(CardBg)
            .border(BorderStroke(1.dp, if (enabled) Rose else Border), FieldShape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(color = Rose, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Add, contentDescription = null, tint = if (enabled) Rose else MutedLight)
                Text(stringResource(R.string.service_photos_add), style = B4UType.CaptionSmall, color = if (enabled) Rose else MutedLight)
            }
        }
    }
}

// Миниатюра декодируется вне главного потока и с inSampleSize под размер плитки (DecodedImages, item75-fix)
@Composable
private fun Thumb(dataUrl: String, modifier: Modifier) {
    val sidePx = with(LocalDensity.current) { ThumbSize.roundToPx() }
    var bitmap by remember(dataUrl) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(dataUrl, sidePx) { bitmap = DecodedImages.decode(dataUrl, sidePx) }
    bitmap?.let {
        androidx.compose.foundation.Image(bitmap = it, contentDescription = null, contentScale = ContentScale.Crop, modifier = modifier)
    }
}
