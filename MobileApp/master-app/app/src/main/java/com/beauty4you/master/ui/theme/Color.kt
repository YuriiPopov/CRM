package com.beauty4you.master.ui.theme

import androidx.compose.ui.graphics.Color

// Токены дизайна — design_handoff_master_app/README.md, раздел "Design Tokens".
val Canvas = Color(0xFFEDE6E1)
val AppBackground = Color(0xFFFAF3EE)
val InkStrong = Color(0xFF3D2027)
val Ink = Color(0xFF4A2530)
val Muted = Color(0xFF8B6F73)
val MutedLight = Color(0xFFB98A93)
val Border = Color(0xFFF0E1E2)
val NavBar = Color(0xFFC08658)
val CardBg = Color(0xFFFFFFFF)

data class StatusColors(val fg: Color, val bg: Color)

val StatusConfirmed = StatusColors(Color(0xFF3F9C5C), Color(0xFFEAF4EC))
val StatusPending = StatusColors(Color(0xFFB8791F), Color(0xFFFBF0DE))
val StatusCancelled = StatusColors(Color(0xFFC24B4B), Color(0xFFFBEAEA))
val StatusDone = StatusColors(Color(0xFF8B8B8B), Color(0xFFF1F0EF))
