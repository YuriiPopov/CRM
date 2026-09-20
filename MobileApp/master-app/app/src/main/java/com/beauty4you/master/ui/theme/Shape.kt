package com.beauty4you.master.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

val CardShape = RoundedCornerShape(16.dp)
val CardShapeSmall = RoundedCornerShape(14.dp)
val ButtonShape = RoundedCornerShape(12.dp)
val PillShape = RoundedCornerShape(999.dp)
val SheetShape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)

val B4UShapes = Shapes(
    extraSmall = ButtonShape,
    small = CardShapeSmall,
    medium = CardShape,
    large = SheetShape,
)
