package com.beauty4you.client.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.beauty4you.client.R
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.Service
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.EmojiTile
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.PushedHeader
import com.beauty4you.client.ui.common.ServicePhotoImage
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.common.formatPrice
import com.beauty4you.client.ui.common.screenWidthPx
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.AppBackground
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.ChipBg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted

/** Состояние списка id фото в карточке: идёт загрузка, готово или не загрузилось (с повтором). */
private sealed interface GalleryState {
    data object Loading : GalleryState
    data class Ready(val ids: List<String>) : GalleryState
    data object Failed : GalleryState
}

/**
 * Карточка услуги (item84): галерея с листанием и точками, по тапу — полноэкранный просмотр. Открывается
 * только у услуг с фото; у услуг без фото список выглядит и работает как раньше.
 */
@Composable
fun ServiceDetailScreen(vm: ClientViewModel, catalog: Catalog, serviceId: String) {
    val service = catalog.service(serviceId)
    if (service == null) {
        // Услуга пропала из каталога после обновления
        LaunchedEffect(serviceId) { vm.back() }
        return
    }

    Column(Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 24.dp),
        ) {
            PushedHeader(stringResource(R.string.service_title), onBack = vm::back)
            VSpace(16.dp)
            ServiceGallery(vm, service)
            VSpace(18.dp)
            Text(service.name, style = B4UType.MasterName, color = InkStrong)
            VSpace(4.dp)
            Text(
                stringResource(R.string.duration_and_price, service.durationMin, formatPrice(service.price)),
                style = B4UType.BodyMuted,
                color = Muted,
            )
            catalog.categories.firstOrNull { it.id == service.categoryId }?.let {
                VSpace(2.dp)
                Text(it.name, style = B4UType.Caption.copy(fontSize = 11.5.sp), color = Muted)
            }
        }

        HorizontalDivider(color = Border)
        Box(Modifier.fillMaxWidth().background(AppBackground).padding(horizontal = PagePadding, vertical = 14.dp)) {
            AccentButton(
                stringResource(R.string.book),
                onClick = { vm.startBooking(service.id) },
                modifier = Modifier.fillMaxWidth(),
                large = true,
            )
        }
    }
}

@Composable
private fun ServiceGallery(vm: ClientViewModel, service: Service) {
    var attempt by remember { mutableIntStateOf(0) }
    var state by remember(service.id) { mutableStateOf<GalleryState>(GalleryState.Loading) }
    LaunchedEffect(service.id, service.photoCount, attempt) {
        state = GalleryState.Loading
        state = try {
            GalleryState.Ready(vm.servicePhotos.ids(service.id, service.photoCount))
        } catch (e: Exception) {
            GalleryState.Failed
        }
    }

    when (val current = state) {
        GalleryState.Loading -> GalleryFrame { CircularProgressIndicator(color = Accent) }
        GalleryState.Failed -> GalleryFrame(Modifier.clickable { attempt++ }) {
            Text(stringResource(R.string.service_photos_error), style = B4UType.BodyMuted, color = Muted)
        }
        is GalleryState.Ready -> if (current.ids.isEmpty()) {
            GalleryFrame { Text(service.emoji, fontSize = 40.sp) }
        } else {
            Gallery(vm, service, current.ids)
        }
    }
}

@Composable
private fun GalleryFrame(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier.fillMaxWidth().height(GALLERY_HEIGHT).clip(GALLERY_SHAPE).background(ChipBg),
        contentAlignment = Alignment.Center,
    ) { content() }
}

private val GALLERY_HEIGHT = 240.dp
private val GALLERY_SHAPE = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)

@Composable
private fun Gallery(vm: ClientViewModel, service: Service, ids: List<String>) {
    val pager = rememberPagerState(pageCount = { ids.size })
    // Номер фото в полноэкранном просмотре; null — просмотр закрыт. Переживает поворот экрана.
    var viewerPage by rememberSaveable(service.id) { mutableStateOf<Int?>(null) }
    val widthPx = screenWidthPx()

    Column {
        Box(Modifier.fillMaxWidth().height(GALLERY_HEIGHT).clip(GALLERY_SHAPE).background(ChipBg)) {
            HorizontalPager(state = pager, modifier = Modifier.fillMaxSize(), key = { ids[it] }) { page ->
                ServicePhotoImage(
                    photos = vm.servicePhotos,
                    photoId = ids[page],
                    maxSidePx = widthPx,
                    modifier = Modifier.fillMaxSize().clickable { viewerPage = page },
                    contentDescription = stringResource(R.string.service_photo_alt, page + 1, ids.size),
                    placeholder = { EmojiTile(service.emoji, Modifier.fillMaxSize(), fontSize = 40, shape = androidx.compose.ui.graphics.RectangleShape) },
                )
            }
        }
        if (ids.size > 1) {
            PagerDots(pager, ids.size, Modifier.align(Alignment.CenterHorizontally).padding(top = 10.dp))
        }
    }

    viewerPage?.let { start ->
        FullscreenViewer(vm, service, ids, start, widthPx, onClose = { viewerPage = null })
    }
}

@Composable
private fun PagerDots(state: PagerState, count: Int, modifier: Modifier = Modifier) {
    Row(modifier.semantics { contentDescription = "${state.currentPage + 1} / $count" }, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(count) { index ->
            Box(
                Modifier
                    .size(if (index == state.currentPage) 8.dp else 6.dp)
                    .clip(CircleShape)
                    .background(if (index == state.currentPage) Accent else Border),
            )
        }
    }
}

// Полноэкранный просмотр: чёрный фон, картинка целиком (Fit), листание, «Назад» и ✕ закрывают
@Composable
private fun FullscreenViewer(
    vm: ClientViewModel,
    service: Service,
    ids: List<String>,
    startPage: Int,
    widthPx: Int,
    onClose: () -> Unit,
) {
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val pager = rememberPagerState(initialPage = startPage.coerceIn(0, ids.lastIndex), pageCount = { ids.size })
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            HorizontalPager(state = pager, modifier = Modifier.fillMaxSize(), key = { ids[it] }) { page ->
                ServicePhotoImage(
                    photos = vm.servicePhotos,
                    photoId = ids[page],
                    maxSidePx = widthPx,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit,
                    contentDescription = stringResource(R.string.service_photo_alt, page + 1, ids.size),
                    placeholder = { CircularProgressIndicator(color = Color.White) },
                )
            }
            Row(
                Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.service_photo_counter, pager.currentPage + 1, ids.size),
                    style = B4UType.Body.copy(fontWeight = FontWeight.Medium),
                    color = Color.White,
                    modifier = Modifier.weight(1f),
                )
                val close = stringResource(R.string.service_viewer_close)
                Text(
                    "✕",
                    fontSize = 20.sp,
                    color = Color.White,
                    modifier = Modifier
                        .clip(CircleShape)
                        .clickable(onClick = onClose)
                        .padding(10.dp)
                        .semantics { contentDescription = close },
                )
            }
        }
    }
}
