package com.beauty4you.master.ui.theme

import androidx.compose.ui.graphics.Color

// Порт 1-в-1 из frontend/src/pages/dashboard/masterColor.ts — тот же хэш и та же палитра,
// чтобы акцентный цвет мастера в его собственном приложении совпадал с его цветом на
// таймлайне веб-дашборда администратора.
private val MASTER_COLOR_PALETTE = listOf(
    Color(0xFF2563EB), // blue
    Color(0xFF16A34A), // green
    Color(0xFFD97706), // amber
    Color(0xFFDB2777), // pink
    Color(0xFF7C3AED), // violet
    Color(0xFF0891B2), // cyan
    Color(0xFFDC2626), // red
    Color(0xFF65A30D), // lime
)

// Совпадает по формуле с Java/Kotlin String.hashCode() — сумма кодов символов * 31 на каждом
// шаге, приведение к unsigned 32-bit, как в исходном TS-файле.
private fun hashString(value: String): Long {
    var hash = 0L
    for (ch in value) {
        hash = (hash * 31 + ch.code) and 0xFFFFFFFFL
    }
    return hash
}

fun getMasterColor(masterId: String): Color {
    val index = (hashString(masterId) % MASTER_COLOR_PALETTE.size).toInt()
    return MASTER_COLOR_PALETTE[index]
}
