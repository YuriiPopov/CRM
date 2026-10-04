package com.beauty4you.admin.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.masterColor
import java.time.LocalDate

// Запись, обогащённая именами из справочников (GET /bookings отдаёт только *Id)
data class BookingItem(
    val booking: Booking,
    val serviceName: String,
    val clientName: String,
    val masterName: String,
    val masterPhoto: String?,
)

fun Catalog.toItem(booking: Booking) = BookingItem(
    booking = booking,
    serviceName = serviceName(booking.serviceId),
    clientName = clientName(booking.clientId),
    masterName = masterName(booking.masterId),
    masterPhoto = mastersById[booking.masterId]?.photo,
)

fun BookingItem.dateTimeLabel(today: LocalDate): String =
    "${PolishDates.relativeDay(booking.date, today)} · ${PolishDates.time(booking.start.toLocalTime())}"

// Карточка визита вида Lista / истории клиента: полоска мастера, услуга, «клиент · мастер»,
// справа дата · время и статус
@Composable
fun BookingCard(
    item: BookingItem,
    today: LocalDate,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String = "${item.clientName} · ${item.masterName}",
    showAccent: Boolean = true,
) {
    B4UCard(modifier = modifier, onClick = onClick) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            if (showAccent) AccentBar(masterColor(item.booking.masterId))
            Column(modifier = Modifier.weight(1f)) {
                Text(item.serviceName, style = B4UType.ItemTitle, color = InkStrong, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    subtitle,
                    style = B4UType.Caption,
                    color = Muted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(DateColumnWidth)) {
                Text(item.dateTimeLabel(today), style = B4UType.Tiny, color = Muted, maxLines = 1)
                StatusPill(item.booking.status, modifier = Modifier.padding(top = 5.dp))
            }
        }
    }
}

private val DateColumnWidth = 104.dp
