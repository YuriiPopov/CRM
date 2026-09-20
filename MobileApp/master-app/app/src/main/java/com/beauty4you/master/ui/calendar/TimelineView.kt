package com.beauty4you.master.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.beauty4you.master.data.repo.Appointment
import com.beauty4you.master.data.repo.DaySchedule
import com.beauty4you.master.ui.common.colors
import com.beauty4you.master.ui.theme.B4UType
import com.beauty4you.master.ui.theme.Border
import com.beauty4you.master.ui.theme.Ink
import com.beauty4you.master.ui.theme.Muted
import java.time.Duration
import java.time.LocalTime
import java.time.format.DateTimeFormatter

private val TIMELINE_START = LocalTime.of(9, 0)
private val TIMELINE_END = LocalTime.of(19, 0)
private const val ROW_MINUTES = 15
private val ROW_HEIGHT = 24.dp
private val HOUR_LABEL_WIDTH = 48.dp

// Заливка недоступной по графику зоны — просто приглушённый серый, без штриховки (диагональные
// линии рисовались через Canvas без обрезки по границам блока и "протекали" за пределы своего
// сегмента на весь таймлайн; сплошная заливка проще и визуально понятнее).
private val UnavailableFill = Muted.copy(alpha = 0.14f)

// Таймлайн одного дня одного мастера, 09:00–19:00, шаг 15 минут (24dp на строку) — см.
// design_handoff_master_app/README.md, раздел "Kalendarz / Timeline view".
@Composable
fun TimelineView(
    appointments: List<Appointment>,
    accentColor: Color,
    modifier: Modifier = Modifier,
    daySchedule: DaySchedule? = null,
    onAppointmentClick: (String) -> Unit = {},
) {
    val totalMinutes = Duration.between(TIMELINE_START, TIMELINE_END).toMinutes().toInt()
    val minutePx = ROW_HEIGHT.value / ROW_MINUTES
    val totalHeight = Dp(totalMinutes * minutePx)

    Box(modifier = modifier.height(totalHeight)) {
        Column(modifier = Modifier.fillMaxWidth()) {
            var current = TIMELINE_START
            while (current.isBefore(TIMELINE_END)) {
                val isHour = current.minute == 0
                Row(modifier = Modifier.fillMaxWidth().height(ROW_HEIGHT)) {
                    Box(modifier = Modifier.width(HOUR_LABEL_WIDTH)) {
                        Text(
                            text = if (isHour) {
                                current.format(DateTimeFormatter.ofPattern("HH:mm"))
                            } else {
                                current.minute.toString()
                            },
                            style = if (isHour) B4UType.BodyStrong else B4UType.Caption,
                            color = if (isHour) Ink else Muted,
                        )
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(if (isHour) Border else Border.copy(alpha = 0.5f)),
                    )
                }
                current = current.plusMinutes(ROW_MINUTES.toLong())
            }
        }

        unavailableSegments(daySchedule, totalMinutes).forEach { (startMinutes, endMinutes) ->
            val topOffset = Dp(startMinutes * minutePx)
            val segmentHeight = Dp((endMinutes - startMinutes) * minutePx)
            Box(
                modifier = Modifier
                    .padding(start = HOUR_LABEL_WIDTH)
                    .offset(y = topOffset)
                    .height(segmentHeight)
                    .fillMaxWidth()
                    .background(UnavailableFill),
            )
        }

        appointments.forEach { appointment ->
            val startMinutes = Duration.between(TIMELINE_START, appointment.startTime).toMinutes().toInt()
            val durationMinutes = Duration.between(appointment.startTime, appointment.endTime).toMinutes().toInt()
            if (startMinutes < 0 || startMinutes >= totalMinutes) return@forEach

            val topOffset = Dp(startMinutes * minutePx)
            val blockHeight = Dp((durationMinutes * minutePx).coerceAtLeast(ROW_HEIGHT.value))
            val statusColors = appointment.status.colors()

            Row(
                modifier = Modifier
                    .padding(start = HOUR_LABEL_WIDTH + 4.dp, end = 8.dp)
                    .offset(y = topOffset)
                    .height(blockHeight)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(statusColors.bg)
                    .clickable { onAppointmentClick(appointment.id) },
            ) {
                Box(modifier = Modifier.width(3.dp).fillMaxHeight().background(accentColor))
                Column(modifier = Modifier.padding(start = 8.dp, top = 4.dp, end = 6.dp)) {
                    Text(
                        text = "${appointment.startTime.format(DateTimeFormatter.ofPattern("HH:mm"))} · ${appointment.clientName}",
                        style = B4UType.Caption.copy(fontWeight = FontWeight.Bold),
                        color = Ink,
                        maxLines = 1,
                    )
                    Text(
                        text = appointment.serviceName,
                        style = B4UType.Caption,
                        color = Muted,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

// Недоступные по графику отрезки внутри окна таймлайна (09:00–19:00), в минутах от начала окна.
// Логика повторяет веб-CRM (frontend/src/pages/dashboard/timeline.ts): отсутствие записи графика
// (NotSet) НЕ считается недоступностью (значит, график просто не проставлен админом), явный
// выходной (Off) заштриховывает весь день, а рабочий день (Working) — только время до начала и
// после конца смены, в пределах окна таймлайна.
private fun unavailableSegments(daySchedule: DaySchedule?, totalMinutes: Int): List<Pair<Int, Int>> =
    when (daySchedule) {
        is DaySchedule.Off -> listOf(0 to totalMinutes)
        is DaySchedule.Working -> {
            val start = runCatching { LocalTime.parse(daySchedule.startTime) }.getOrNull()
            val end = runCatching { LocalTime.parse(daySchedule.endTime) }.getOrNull()
            if (start == null || end == null) {
                emptyList()
            } else {
                val segments = mutableListOf<Pair<Int, Int>>()
                val startMinutes = Duration.between(TIMELINE_START, start).toMinutes().toInt().coerceIn(0, totalMinutes)
                val endMinutes = Duration.between(TIMELINE_START, end).toMinutes().toInt().coerceIn(0, totalMinutes)
                if (startMinutes > 0) segments += 0 to startMinutes
                if (endMinutes < totalMinutes) segments += endMinutes to totalMinutes
                segments
            }
        }
        is DaySchedule.NotSet, null -> emptyList()
    }
