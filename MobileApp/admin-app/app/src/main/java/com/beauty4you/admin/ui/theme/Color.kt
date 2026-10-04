package com.beauty4you.admin.ui.theme

import androidx.compose.ui.graphics.Color
import com.beauty4you.admin.domain.AvatarColors
import com.beauty4you.admin.domain.MasterColors

// Токены дизайна «B4U Admin App» (Design/B4U Admin App.dc.html)
val AppBackground = Color(0xFFFAF3EE)
val SoftBackground = Color(0xFFFDF8F6)
val SheetBackground = Color(0xFFFFFDFB)
val InkStrong = Color(0xFF3D2027)
val Ink = Color(0xFF4A2530)
val Muted = Color(0xFF8B6F73)
val MutedLight = Color(0xFFB98A93)
val GridLabel = Color(0xFFB7A0A3)
val Border = Color(0xFFF0E1E2)
val BorderSoft = Color(0xFFF5EBEC)
val DashedBorder = Color(0xFFE3CBCE)
val Tint = Color(0xFFF3E7E4)
val Accent = Color(0xFFC9445A)
val Rose = Color(0xFFC97B8E)
val NavBar = Color(0xFFC08658)
val CardBg = Color(0xFFFFFFFF)
val DangerBorder = Color(0xFFF1C7C7)
val Scrim = Color(0x593D2027)
val BlockFill = Color(0x2E8B6F73)
val OffHoursFill = Color(0x148B6F73)

data class StatusColors(val fg: Color, val bg: Color)

// Таблица статусов из ТЗ item73 (дизайн -> backend)
val StatusPending = StatusColors(Color(0xFFB8791F), Color(0xFFFBF0DE))
val StatusConfirmed = StatusColors(Color(0xFF3F9C5C), Color(0xFFEAF4EC))
val StatusDone = StatusColors(Color(0xFF8B8B8B), Color(0xFFF1F0EF))
val StatusCancelled = StatusColors(Color(0xFFC24B4B), Color(0xFFFBEAEA))

fun masterColor(masterId: String): Color = Color(MasterColors.argb(masterId))

fun avatarColor(clientId: String): Color = Color(AvatarColors.argb(clientId))
