package com.beauty4you.client.ui.common

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.beauty4you.client.data.ServicePhotos
import com.beauty4you.client.ui.theme.ChipBg
import com.beauty4you.client.ui.theme.TileShape

/** Ширина экрана в px — размер, под который грузятся картинки галереи (карточка и полноэкранный просмотр делят кэш). */
@Composable
fun screenWidthPx(): Int = with(LocalDensity.current) { LocalConfiguration.current.screenWidthDp.dp.roundToPx() }

/**
 * Фото услуги по id: загрузка и декодирование идут вне главного потока (ServicePhotos), пока картинки нет
 * или она не загрузилась — показывается [placeholder]. Размер декодирования — [maxSidePx] по короткой стороне.
 */
@Composable
fun ServicePhotoImage(
    photos: ServicePhotos<ImageBitmap>,
    photoId: String,
    maxSidePx: Int,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    contentDescription: String? = null,
    placeholder: @Composable () -> Unit = {},
) {
    var bitmap by remember(photoId, maxSidePx) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(photoId, maxSidePx) { bitmap = photos.bitmap(photoId, maxSidePx) }
    val image = bitmap
    if (image != null) {
        Image(bitmap = image, contentDescription = contentDescription, contentScale = contentScale, modifier = modifier)
    } else {
        Box(modifier, contentAlignment = Alignment.Center) { placeholder() }
    }
}

/** Квадратное превью обложки услуги в списках (Usługi, выбор услуги при записи). */
@Composable
fun ServiceCover(photos: ServicePhotos<ImageBitmap>, photoId: String, size: Dp = 52.dp) {
    val sidePx = with(LocalDensity.current) { size.roundToPx() }
    ServicePhotoImage(
        photos = photos,
        photoId = photoId,
        maxSidePx = sidePx,
        modifier = Modifier.size(size).clip(TileShape).background(ChipBg),
    )
}
