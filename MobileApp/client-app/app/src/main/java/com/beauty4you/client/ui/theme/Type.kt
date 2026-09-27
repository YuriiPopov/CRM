package com.beauty4you.client.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.beauty4you.client.R

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

private fun serif(size: Float, weight: FontWeight = FontWeight.Bold) =
    TextStyle(fontFamily = PlayfairDisplay, fontWeight = weight, fontSize = size.sp)

private fun sans(size: Float, weight: FontWeight = FontWeight.Normal) =
    TextStyle(fontFamily = Inter, fontWeight = weight, fontSize = size.sp)

// Именованные стили из HTML-прототипа (Playfair 34/24/22/20/19/18/16, Inter 10–14.5) —
// размеры дизайна не укладываются в стандартные слоты Material3 Typography.
object B4UType {
    val Balance = serif(34f)
    val ScreenTitle = serif(24f)
    val LoyaltyTitle = serif(22f)
    val PushedTitle = serif(20f)
    val Total = serif(20f)
    val SheetTitle = serif(19f)
    val SectionHeader = serif(18f)
    val MasterName = serif(18f)
    val SubSection = serif(16f)

    val RowTitle = sans(14f, FontWeight.SemiBold)
    val CardTitle = sans(13.5f, FontWeight.SemiBold)
    val CardTitleBold = sans(13.5f, FontWeight.Bold)
    val Body = sans(13f)
    val BodyMuted = sans(12.5f)
    val Caption = sans(12f)
    val CaptionStrong = sans(12f, FontWeight.SemiBold)
    val Button = sans(12f, FontWeight.Bold)
    val SmallLabel = sans(11f, FontWeight.SemiBold)
    val FieldLabel = sans(11.5f, FontWeight.SemiBold)
    val Overline = sans(13f, FontWeight.Bold)
    val Pill = sans(10.5f, FontWeight.SemiBold)
    val NavLabel = sans(10f, FontWeight.SemiBold)
}

val B4UTypography = Typography(
    headlineSmall = B4UType.ScreenTitle,
    titleLarge = B4UType.SectionHeader,
    bodyLarge = B4UType.Body,
    bodyMedium = B4UType.CardTitle,
    bodySmall = B4UType.Caption,
    labelSmall = B4UType.Pill,
)
