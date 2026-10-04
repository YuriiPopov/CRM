package com.beauty4you.client.ui.theme

import androidx.compose.ui.graphics.Color

// Токены дизайна — design_handoff_b4u_android_app/README.md, раздел "Design Tokens".
val AppBackground = Color(0xFFFAF3EE)
val InkStrong = Color(0xFF3D2027)
val Ink = Color(0xFF4A2530)
val Muted = Color(0xFF8B6F73)
val MutedLight = Color(0xFFB98A93)
val Border = Color(0xFFF0E1E2)
val CardBg = Color(0xFFFFFFFF)
val Accent = Color(0xFFC97B8E)
val AccentPressed = Color(0xFFA85B7A)
val OnDarkMuted = Color(0xFFD9B9BD)
val ChipBg = Color(0xFFF3E7E4)
val DashedBorder = Color(0xFFE3CBCE)
val EmptyBg = Color(0xFFFDF8F6)
val SheetBg = Color(0xFFFFFDFB)
val Scrim = Color(0x593D2027)
val DisabledBg = Color(0xFFF1F0EF)
val DisabledFg = Color(0xFFB0A6A3)
val CancelBorder = Color(0xFFF1C7C7)

data class StatusColors(val fg: Color, val bg: Color)

val StatusConfirmed = StatusColors(Color(0xFF3F9C5C), Color(0xFFEAF4EC))
val StatusPending = StatusColors(Color(0xFFB8791F), Color(0xFFFBF0DE))
val StatusDone = StatusColors(Color(0xFF8B8B8B), Color(0xFFF1F0EF))
val StatusCancelled = StatusColors(Color(0xFFC24B4B), Color(0xFFFBEAEA))
val StatusNoShow = StatusColors(Color(0xFF9B3A3A), Color(0xFFF6DADA))
