package com.beauty4you.master.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

// Дизайн только светлый (README не описывает тёмную тему) — системная тёмная тема не
// учитывается, светлая схема применяется всегда.
private val B4UColorScheme = lightColorScheme(
    primary = Ink,
    onPrimary = AppBackground,
    secondary = Muted,
    background = AppBackground,
    surface = CardBg,
    onBackground = InkStrong,
    onSurface = InkStrong,
    outline = Border,
    error = StatusCancelled.fg,
)

@Composable
fun B4UMasterTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = B4UColorScheme,
        typography = B4UTypography,
        shapes = B4UShapes,
        content = content,
    )
}
