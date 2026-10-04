package com.beauty4you.admin.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

// Дизайн только светлый — системная тёмная тема не учитывается (как в master-app)
private val B4UColorScheme = lightColorScheme(
    primary = Rose,
    onPrimary = CardBg,
    secondary = Muted,
    background = AppBackground,
    surface = CardBg,
    surfaceContainerLow = CardBg,
    surfaceContainerHigh = SheetBackground,
    onBackground = InkStrong,
    onSurface = InkStrong,
    onSurfaceVariant = Muted,
    outline = Border,
    outlineVariant = Border,
    error = StatusCancelled.fg,
)

@Composable
fun B4UAdminTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = B4UColorScheme,
        typography = B4UTypography,
        shapes = B4UShapes,
        content = content,
    )
}
