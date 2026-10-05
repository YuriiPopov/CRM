package com.beauty4you.admin.ui.common

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import com.beauty4you.admin.domain.Client
import com.beauty4you.admin.ui.theme.StatusNoShow
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.domain.ClientLogic
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.CardShape
import com.beauty4you.admin.ui.theme.CardShapeSmall
import com.beauty4you.admin.ui.theme.DashedBorder
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.MutedLight
import com.beauty4you.admin.ui.theme.PillShape
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.SoftBackground
import com.beauty4you.admin.ui.theme.Tint
import com.beauty4you.admin.ui.theme.avatarColor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Заголовок экрана: Playfair 24 + подзаголовок, опционально «←» и действие справа
@Composable
fun ScreenHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    action: @Composable RowScope.() -> Unit = {},
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) {
            IconButton(onClick = onBack, modifier = Modifier.size(36.dp)) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back),
                    tint = MutedLight,
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = B4UType.ScreenTitle, color = Ink)
            if (subtitle != null) {
                Text(text = subtitle, style = B4UType.Body, color = Muted, modifier = Modifier.padding(top = 2.dp))
            }
        }
        action()
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text = text, style = B4UType.SectionHeader, color = Ink, modifier = modifier)
}

@Composable
fun StatusPill(status: BookingStatus, modifier: Modifier = Modifier) {
    val colors = status.colors()
    Box(
        modifier = modifier
            .clip(PillShape)
            .background(colors.bg)
            .padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Text(text = stringResource(status.labelRes()), style = B4UType.Pill, color = colors.fg, maxLines = 1)
    }
}

// Метка «🚩 Niewiarygodny» (item74) — флаг считает бэкенд (3+ неявок); для надёжного клиента ничего
@Composable
fun UnreliableBadge(client: Client, modifier: Modifier = Modifier) {
    if (!client.unreliable) return
    Box(
        modifier = modifier
            .clip(PillShape)
            .background(StatusNoShow.bg)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(text = stringResource(R.string.client_unreliable), style = B4UType.Pill, color = StatusNoShow.fg, maxLines = 1)
    }
}

// Белая карточка с рамкой из дизайна
@Composable
fun B4UCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(CardShapeSmall)
            .background(CardBg)
            .border(BorderStroke(1.dp, Border), CardShapeSmall)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
    ) { content() }
}

// Вертикальная цветная полоска мастера слева на карточке визита
@Composable
fun AccentBar(color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .width(4.dp)
            .height(36.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(color),
    )
}

@Composable
fun ColorDot(color: Color, size: Dp = 8.dp) {
    Box(modifier = Modifier.size(size).clip(CircleShape).background(color))
}

// Пустое состояние с пунктирной рамкой (как в дизайне)
@Composable
fun DashedEmptyState(title: String, modifier: Modifier = Modifier, text: String? = null) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(SoftBackground)
            .dashedBorder(DashedBorder),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 28.dp),
        ) {
            Box(modifier = Modifier.size(44.dp).clip(CircleShape).background(Color(0xFFF3E3E5)))
            Text(
                text = title,
                style = B4UType.ItemTitle.copy(fontSize = 14.5.sp),
                color = Ink,
                modifier = Modifier.padding(top = 10.dp),
            )
            if (text != null) {
                Text(text = text, style = B4UType.Caption.copy(fontSize = 12.5.sp), color = Muted, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

private fun Modifier.dashedBorder(color: Color): Modifier = drawBehind {
    drawRoundRect(
        color = color,
        style = Stroke(width = 1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f))),
        cornerRadius = CornerRadius(16.dp.toPx()),
    )
}

@Composable
fun ErrorState(onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = stringResource(R.string.error_load), style = B4UType.Body, color = Muted)
        TextButton(onClick = onRetry) {
            Text(text = stringResource(R.string.action_retry), style = B4UType.Button, color = Rose)
        }
    }
}

// Скелетон загрузки — пульсирующие плашки
@Composable
fun SkeletonList(rows: Int = 4, height: Dp = 64.dp, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(550), RepeatMode.Reverse),
        label = "skeletonAlpha",
    )
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(rows) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(height)
                    .alpha(alpha)
                    .clip(CardShapeSmall)
                    .background(Tint),
            )
        }
    }
}

// Аватар клиента: инициалы на цветном круге
@Composable
fun InitialsAvatar(clientId: String, name: String, size: Dp, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.size(size).clip(CircleShape).background(avatarColor(clientId)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = ClientLogic.initials(name),
            color = Color.White,
            style = B4UType.BodyStrong.copy(fontSize = (size.value * 0.34f).sp),
        )
    }
}

// Фото мастера: Master.photo — base64 data URL (не HTTP-URL), декодируем сами (как в master-app)
@Composable
fun MasterPhoto(photo: String?, size: Dp, modifier: Modifier = Modifier) {
    var bitmap by remember(photo) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(photo) {
        bitmap = photo?.let { decodePhoto(it) }
    }
    Box(modifier = modifier.size(size).clip(CircleShape).background(Tint)) {
        bitmap?.let {
            Image(bitmap = it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        }
    }
}

// Картинка новости (item75) — тоже base64 data URL; пока декодируется или если её нет — placeholder
@Composable
fun DataUrlImage(
    dataUrl: String?,
    modifier: Modifier = Modifier,
    placeholder: @Composable () -> Unit = {},
) {
    var bitmap by remember(dataUrl) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(dataUrl) {
        bitmap = dataUrl?.let { decodePhoto(it) }
    }
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        val image = bitmap
        if (image != null) {
            Image(bitmap = image, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            placeholder()
        }
    }
}

private val photoCache = HashMap<Int, ImageBitmap>()

// Картинки новостей до 1600 px — для экрана телефона хватает половины, в память кладём уменьшенную
private const val DECODE_MAX_SIDE = 1200

private suspend fun decodePhoto(dataUrl: String): ImageBitmap? = withContext(Dispatchers.Default) {
    val key = dataUrl.hashCode()
    synchronized(photoCache) { photoCache[key] }?.let { return@withContext it }
    runCatching {
        val bytes = android.util.Base64.decode(dataUrl.substringAfter(",", dataUrl), android.util.Base64.DEFAULT)
        val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= DECODE_MAX_SIDE) sample *= 2
        val options = android.graphics.BitmapFactory.Options().apply { inSampleSize = sample }
        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.asImageBitmap()
    }.getOrNull()?.also { synchronized(photoCache) { photoCache[key] = it } }
}

// Строка «Название · подзаголовок» для карточек
@Composable
fun TwoLineText(title: String, subtitle: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(text = title, style = B4UType.ItemTitle, color = InkStrong, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            text = subtitle,
            style = B4UType.Caption,
            color = Muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

// Пунктирная горизонтальная линия (15-минутная линия сетки Timeline)
@Composable
fun DashedLine(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxWidth().height(1.dp)) {
        drawLine(
            color = color,
            start = androidx.compose.ui.geometry.Offset(0f, 0f),
            end = androidx.compose.ui.geometry.Offset(size.width, 0f),
            strokeWidth = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f)),
        )
    }
}
