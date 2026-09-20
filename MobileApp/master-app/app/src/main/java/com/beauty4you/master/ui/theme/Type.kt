package com.beauty4you.master.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.beauty4you.master.R

val PlayfairDisplay = FontFamily(
    Font(R.font.playfair_display_semibold, FontWeight.SemiBold),
    Font(R.font.playfair_display_bold, FontWeight.Bold),
)

val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
    Font(R.font.inter_bold, FontWeight.Bold),
)

// Именованные текстовые стили из README дизайна ("Playfair Display 24px/700" и т.п.) —
// используются напрямую в экранах поверх Material3 Typography, т.к. размеры дизайна не
// укладываются в стандартные слоты (headlineLarge и т.д.).
object B4UType {
    val ScreenTitle = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.Bold, fontSize = 24.sp)
    val ScreenSubtitleSerif = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.SemiBold, fontSize = 19.sp)
    val SectionHeader = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    val IdentityName = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    val StatNumber = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    val ServiceName = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
    val BodyStrong = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
    val Body = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 13.sp)
    val Caption = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 12.sp)
    val StatLabel = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 11.sp)
    val Pill = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 10.5.sp)
}

val B4UTypography = Typography(
    headlineSmall = B4UType.ScreenTitle,
    titleLarge = B4UType.SectionHeader,
    titleMedium = B4UType.IdentityName,
    bodyLarge = B4UType.Body,
    bodyMedium = B4UType.ServiceName,
    bodySmall = B4UType.Caption,
    labelSmall = B4UType.Pill,
)
