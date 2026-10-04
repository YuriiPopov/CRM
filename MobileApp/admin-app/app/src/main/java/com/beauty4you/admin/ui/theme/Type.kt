package com.beauty4you.admin.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.beauty4you.admin.R

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

// Именованные стили из дизайна (размеры не ложатся в стандартные слоты Material3)
object B4UType {
    val ScreenTitle = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.Bold, fontSize = 24.sp)
    val ScreenSubtitleSerif = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.SemiBold, fontSize = 19.sp)
    val SheetTitle = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.Bold, fontSize = 19.sp)
    val SectionHeader = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    val SectionHeaderSmall = TextStyle(fontFamily = PlayfairDisplay, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    val Title = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 17.sp)
    val ItemTitle = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
    val ItemTitleBold = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    val Body = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 13.sp)
    val BodyStrong = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
    val Caption = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 12.sp)
    val CaptionSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 11.5.sp)
    val Tiny = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 11.sp)
    val Label = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp)
    val Pill = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 10.5.sp)
    val Button = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
    val Stat = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp)
}

val B4UTypography = Typography(
    headlineSmall = B4UType.ScreenTitle,
    titleLarge = B4UType.SectionHeader,
    titleMedium = B4UType.Title,
    bodyLarge = B4UType.Body,
    bodyMedium = B4UType.ItemTitle,
    bodySmall = B4UType.Caption,
    labelLarge = B4UType.Button,
    labelSmall = B4UType.Pill,
)
