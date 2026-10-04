package com.beauty4you.client.ui.common

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beauty4you.client.R
import com.beauty4you.client.data.BookingStatus
import com.beauty4you.client.data.Master
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.ButtonShape
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.CardShape
import com.beauty4you.client.ui.theme.ChipBg
import com.beauty4you.client.ui.theme.DashedBorder
import com.beauty4you.client.ui.theme.EmptyBg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.MutedLight
import com.beauty4you.client.ui.theme.PillShape
import com.beauty4you.client.ui.theme.StatusCancelled
import com.beauty4you.client.ui.theme.StatusColors
import com.beauty4you.client.ui.theme.StatusConfirmed
import com.beauty4you.client.ui.theme.StatusDone
import com.beauty4you.client.ui.theme.StatusNoShow
import com.beauty4you.client.ui.theme.StatusPending
import com.beauty4you.client.ui.theme.TileShape
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

val PagePadding = 18.dp

/**
 * Растягивает элемент на [horizontal] за пределы паддинга родителя — для горизонтальных
 * каруселей, которые скроллятся от края до края экрана, но начинаются по линии контента.
 */
fun Modifier.bleed(horizontal: Dp): Modifier = layout { measurable, constraints ->
    val px = horizontal.roundToPx()
    val placeable = measurable.measure(
        constraints.copy(minWidth = constraints.minWidth + 2 * px, maxWidth = constraints.maxWidth + 2 * px),
    )
    layout(placeable.width - 2 * px, placeable.height) { placeable.place(-px, 0) }
}

/** Плоская карточка дизайна: белый фон + 1px бордер #F0E1E2, без тени. */
@Composable
fun B4UCard(
    modifier: Modifier = Modifier,
    shape: Shape = CardShape,
    onClick: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .clip(shape)
            .background(CardBg)
            .border(1.dp, Border, shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(contentPadding),
        content = content,
    )
}

@Composable
fun B4URowCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 11.dp),
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(CardBg)
            .border(1.dp, Border, CardShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(contentPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

@Composable
fun AccentButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    large: Boolean = false,
) {
    Box(
        modifier = modifier
            .clip(if (large) ButtonShape else TileShape)
            .background(Accent)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = if (large) 14.dp else 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            style = if (large) B4UType.Button.copy(fontSize = 14.sp) else B4UType.Button,
            color = Color.White,
        )
    }
}

@Composable
fun OutlineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = Ink,
    borderColor: Color = Border,
    background: Color = CardBg,
    enabled: Boolean = true,
    bold: Boolean = false,
) {
    Box(
        modifier = modifier
            .clip(TileShape)
            .background(background)
            .border(BorderStroke(1.dp, borderColor), TileShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = if (bold) B4UType.Button else B4UType.CaptionStrong, color = color)
    }
}

@Composable
fun ScreenTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, style = B4UType.ScreenTitle, color = Ink, modifier = modifier)
}

/** Заголовок "pushed" экрана: стрелка назад + serif-заголовок. */
@Composable
fun PushedHeader(title: String, onBack: () -> Unit, large: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            "←",
            fontSize = 18.sp,
            color = MutedLight,
            modifier = Modifier
                .clip(CircleShape)
                .clickable(onClick = onBack)
                .padding(end = 12.dp, top = 4.dp, bottom = 4.dp),
        )
        Text(title, style = if (large) B4UType.LoyaltyTitle else B4UType.PushedTitle, color = Ink)
    }
}

/** Заглавная подпись секции ("JAK ZDOBYWAĆ", "KONTAKT", категории услуг). */
@Composable
fun Overline(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        style = B4UType.Overline.copy(letterSpacing = 0.4.sp),
        color = Muted,
        modifier = modifier,
    )
}

@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(text, style = B4UType.SectionHeader, color = Ink, modifier = modifier)
}

/** Пустое состояние: пунктирная рамка на светлом фоне. */
@Composable
fun EmptyState(title: String, text: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(EmptyBg)
            .drawBehind {
                drawRoundRect(
                    color = DashedBorder,
                    cornerRadius = CornerRadius(16.dp.toPx()),
                    style = Stroke(
                        width = 1.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx())),
                    ),
                )
            }
            .padding(horizontal = 20.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = B4UType.CardTitle.copy(fontSize = 14.5.sp), color = Ink)
        Spacer(Modifier.size(4.dp))
        Text(text, style = B4UType.BodyMuted, color = Muted, textAlign = TextAlign.Center)
    }
}

/** Плейсхолдер-плитка с эмодзи (услуги, новости) до появления реальных иллюстраций. */
@Composable
fun EmojiTile(emoji: String, modifier: Modifier = Modifier, fontSize: Int = 22, shape: Shape = TileShape) {
    Box(
        modifier = modifier.clip(shape).background(ChipBg),
        contentAlignment = Alignment.Center,
    ) {
        Text(emoji, fontSize = fontSize.sp)
    }
}

@Composable
fun IconImageTile(@DrawableRes icon: Int, size: Dp = 36.dp, shape: Shape = TileShape, alpha: Float = 1f) {
    Image(
        painter = painterResource(icon),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        alpha = alpha,
        modifier = Modifier.size(size).clip(shape),
    )
}

/** Фото мастера в цветном кольце; без фото — первая буква имени на фоне плейсхолдера. */
@Composable
fun MasterAvatar(master: Master, size: Dp) {
    val modifier = Modifier
        .size(size)
        .clip(CircleShape)
        .background(ChipBg)
        .border(2.dp, master.color, CircleShape)
    val photo = master.photo
    if (photo != null) {
        Image(bitmap = photo, contentDescription = master.name, contentScale = ContentScale.Crop, modifier = modifier)
    } else {
        Box(modifier, contentAlignment = Alignment.Center) {
            Text(master.name.take(1).uppercase(), fontSize = (size.value * 0.4f).sp, color = master.color)
        }
    }
}

/** 125.0 → "125", 99.5 → "99,50" (цены в БД — Decimal(10,2)). */
fun formatPrice(price: Double): String =
    if (price % 1.0 == 0.0) price.toLong().toString() else String.format(PolishLocale, "%.2f", price)

fun statusColors(status: BookingStatus): StatusColors = when (status) {
    BookingStatus.CONFIRMED -> StatusConfirmed
    BookingStatus.PENDING -> StatusPending
    BookingStatus.DONE -> StatusDone
    BookingStatus.CANCELLED -> StatusCancelled
    BookingStatus.NO_SHOW -> StatusNoShow
}

@Composable
fun statusLabel(status: BookingStatus): String = stringResource(
    when (status) {
        BookingStatus.CONFIRMED -> R.string.status_confirmed
        BookingStatus.PENDING -> R.string.status_pending
        BookingStatus.DONE -> R.string.status_done
        BookingStatus.CANCELLED -> R.string.status_cancelled
        BookingStatus.NO_SHOW -> R.string.status_no_show
    },
)

@Composable
fun StatusPill(status: BookingStatus) {
    val colors = statusColors(status)
    Text(
        statusLabel(status),
        style = B4UType.Pill,
        color = colors.fg,
        modifier = Modifier
            .clip(PillShape)
            .background(colors.bg)
            .padding(horizontal = 9.dp, vertical = 3.dp),
    )
}

@Composable
fun Pill(text: String, fg: Color, bg: Color, modifier: Modifier = Modifier) {
    Text(
        text,
        style = B4UType.SmallLabel.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
        color = fg,
        modifier = modifier
            .clip(PillShape)
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

private val PolishLocale = Locale.forLanguageTag("pl-PL")
private val DayMonthFormat = DateTimeFormatter.ofPattern("d MMMM", PolishLocale)

/** "Dzisiaj" для сегодняшней даты, иначе "2 września" — как в прототипе. */
@Composable
fun formatDate(date: LocalDate): String =
    if (date == LocalDate.now()) stringResource(R.string.today) else date.format(DayMonthFormat)

@Composable
fun VSpace(height: Dp) = Spacer(Modifier.size(height))

@Composable
fun HSpace(width: Dp) = Spacer(Modifier.width(width))
