package com.beauty4you.client.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

val CardShape = RoundedCornerShape(14.dp)
val LargeShape = RoundedCornerShape(16.dp)
val ButtonShape = RoundedCornerShape(12.dp)
val TileShape = RoundedCornerShape(10.dp)
val PillShape = RoundedCornerShape(999.dp)
val SheetShape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)

// Дизайн только светлый (README не описывает тёмную тему) — светлая схема применяется всегда.
private val B4UColorScheme = lightColorScheme(
    primary = Accent,
    onPrimary = CardBg,
    secondary = Muted,
    background = AppBackground,
    surface = CardBg,
    onBackground = InkStrong,
    onSurface = InkStrong,
    outline = Border,
    error = StatusCancelled.fg,
)

@Composable
fun B4UClientTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = B4UColorScheme,
        typography = B4UTypography,
        shapes = Shapes(extraSmall = ButtonShape, small = CardShape, medium = LargeShape, large = SheetShape),
        content = content,
    )
}
