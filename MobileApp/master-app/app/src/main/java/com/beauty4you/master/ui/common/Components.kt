package com.beauty4you.master.ui.common

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.beauty4you.master.data.model.BookingStatus
import com.beauty4you.master.ui.theme.B4UType
import com.beauty4you.master.ui.theme.Border
import com.beauty4you.master.ui.theme.CardBg
import com.beauty4you.master.ui.theme.CardShape
import com.beauty4you.master.ui.theme.CardShapeSmall
import com.beauty4you.master.ui.theme.Ink
import com.beauty4you.master.ui.theme.Muted
import com.beauty4you.master.ui.theme.PillShape

@Composable
fun StatusPill(status: BookingStatus, modifier: Modifier = Modifier) {
    val colors = status.colors()
    Box(
        modifier = modifier
            .clip(PillShape)
            .background(colors.bg)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text = status.label(), style = B4UType.Pill, color = colors.fg)
    }
}

@Composable
fun StatCard(value: String, label: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = CardShapeSmall,
        colors = CardDefaults.cardColors(containerColor = CardBg),
        border = BorderStroke(1.dp, Border),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(text = value, style = B4UType.StatNumber, color = Ink)
            Text(text = label, style = B4UType.StatLabel, color = Muted)
        }
    }
}

@Composable
fun MasterAvatar(
    photoBase64: String?,
    accentColor: Color,
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    // Master.photo хранится бэкендом как base64 data URL (см. schema.prisma), не как HTTP(S)-URL —
    // Coil по умолчанию не умеет data:-URI, поэтому декодируем в Bitmap сами и передаём его моделью.
    var bitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(photoBase64) {
        bitmap = if (photoBase64 != null) decodeBase64Photo(photoBase64) else null
    }

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .border(2.dp, accentColor, CircleShape)
            .background(Border),
    ) {
        bitmap?.let {
            AsyncImage(
                model = it,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().clip(CircleShape),
            )
        }
    }
}

private suspend fun decodeBase64Photo(dataUrl: String): android.graphics.Bitmap? =
    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
        runCatching {
            val base64 = dataUrl.substringAfter(",", dataUrl)
            val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }.getOrNull()
    }

@Composable
fun EmptyState(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(Color(0xFFFDF8F6))
            .border(BorderStroke(1.dp, Color(0xFFE3CBCE)), CardShape)
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text, style = B4UType.Body, color = Muted)
    }
}

@Composable
fun AppointmentRow(
    time: String,
    serviceName: String,
    clientName: String,
    status: BookingStatus,
    accentColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = time,
            style = B4UType.BodyStrong,
            color = Ink,
            modifier = Modifier.padding(end = 8.dp),
        )
        Box(
            modifier = Modifier
                .size(width = 4.dp, height = 32.dp)
                .background(accentColor),
        )
        Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
            Text(text = serviceName, style = B4UType.ServiceName, color = Ink, maxLines = 1)
            Text(text = clientName, style = B4UType.Caption, color = Muted, maxLines = 1)
        }
        StatusPill(status = status)
    }
}
