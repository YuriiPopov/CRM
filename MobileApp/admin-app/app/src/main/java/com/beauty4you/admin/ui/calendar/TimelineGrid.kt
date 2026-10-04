package com.beauty4you.admin.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beauty4you.admin.R
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.MasterBlock
import com.beauty4you.admin.domain.PolishDates
import com.beauty4you.admin.domain.ScheduleDay
import com.beauty4you.admin.domain.TimelineLayout
import com.beauty4you.admin.domain.TimelineSpan
import com.beauty4you.admin.ui.common.DashedLine
import com.beauty4you.admin.ui.common.MasterPhoto
import com.beauty4you.admin.ui.common.colors
import com.beauty4you.admin.ui.theme.AppBackground
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.BlockFill
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.GridLabel
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.OffHoursFill
import com.beauty4you.admin.ui.theme.masterColor
import java.time.LocalDate

// Сетка дизайна: строка 15 минут = 24dp, колонки мастеров от 120dp. Колонка подписей шире
// дизайновых 40dp — иначе «09:00» при увеличенном системном шрифте переносилось на две строки.
private val ROW_HEIGHT = 24.dp
private val LABEL_WIDTH = 48.dp
private val MIN_COLUMN_WIDTH = 120.dp
private val HEADER_HEIGHT = 76.dp

private fun minutesToDp(minutes: Int): Dp = ROW_HEIGHT * (minutes.toFloat() / TimelineLayout.STEP_MINUTES)

@Composable
fun TimelineGrid(
    day: LocalDate,
    masters: List<Master>,
    bookings: List<Booking>,
    blocks: List<MasterBlock>,
    schedule: Map<Pair<String, LocalDate>, ScheduleDay>,
    catalog: Catalog,
    onOpenBooking: (Booking) -> Unit,
) {
    val gridLines = TimelineLayout.gridLines()
    val bodyHeight = minutesToDp(TimelineLayout.TOTAL_MINUTES)

    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val available = maxWidth - LABEL_WIDTH
        val columnWidth = if (masters.isEmpty()) available else maxOf(MIN_COLUMN_WIDTH, available / masters.size)

        Row {
            // Подписи часов — вне горизонтального скролла, всегда видны слева. Каждая подпись — блок
            // высотой в строку, центрированный ровно по своей линии сетки (а не сдвиг на «примерно
            // полстроки»), поэтому совпадает с линией при любом шрифте и масштабе текста системы.
            Column(modifier = Modifier.width(LABEL_WIDTH).background(AppBackground)) {
                Spacer(Modifier.height(HEADER_HEIGHT))
                Box(Modifier.height(bodyHeight)) {
                    gridLines.forEach { line -> HourLabel(line.label, line.isHour, line.topMinutes) }
                    HourLabel(PolishDates.time(TimelineLayout.WINDOW_END), isHour = true, topMinutes = TimelineLayout.TOTAL_MINUTES)
                }
                // Нижняя подпись «19:00» центрирована по последней линии и выступает на полстроки
                Spacer(Modifier.height(ROW_HEIGHT / 2))
            }

            Column(modifier = Modifier.horizontalScroll(rememberScrollState())) {
                Row {
                    masters.forEach { master ->
                        ColumnHeader(master, schedule[master.id to day], Modifier.width(columnWidth))
                    }
                }
                Row {
                    masters.forEach { master ->
                        MasterColumn(
                            day = day,
                            gridTops = gridLines.map { it.topMinutes to it.isHour },
                            bookings = bookings.filter { it.masterId == master.id },
                            blocks = blocks.filter { it.masterId == master.id },
                            schedule = schedule[master.id to day],
                            catalog = catalog,
                            onOpenBooking = onOpenBooking,
                            modifier = Modifier.width(columnWidth).height(bodyHeight),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HourLabel(label: String, isHour: Boolean, topMinutes: Int) {
    Box(
        contentAlignment = Alignment.CenterEnd,
        modifier = Modifier
            .offset(y = minutesToDp(topMinutes) - ROW_HEIGHT / 2)
            .width(LABEL_WIDTH)
            .height(ROW_HEIGHT)
            .padding(end = 6.dp),
    ) {
        Text(
            text = label,
            style = B4UType.Tiny.copy(
                fontSize = if (isHour) 11.5.sp else 10.sp,
                fontWeight = if (isHour) FontWeight.Bold else FontWeight.Medium,
            ),
            color = if (isHour) Ink else GridLabel,
            maxLines = 1,
            softWrap = false,
        )
    }
}

@Composable
private fun ColumnHeader(master: Master, schedule: ScheduleDay?, modifier: Modifier) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.height(HEADER_HEIGHT).padding(horizontal = 4.dp),
    ) {
        MasterPhoto(master.photo, size = 32.dp)
        Text(
            master.name.uppercase(),
            style = B4UType.Pill.copy(fontWeight = FontWeight.Bold),
            color = Ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp),
        )
        Text(TimelineLayout.hoursLabel(schedule), style = B4UType.Tiny.copy(fontSize = 9.sp), color = Muted, maxLines = 1)
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Border))
    }
}

@Composable
private fun MasterColumn(
    day: LocalDate,
    gridTops: List<Pair<Int, Boolean>>,
    bookings: List<Booking>,
    blocks: List<MasterBlock>,
    schedule: ScheduleDay?,
    catalog: Catalog,
    onOpenBooking: (Booking) -> Unit,
    modifier: Modifier,
) {
    Box(modifier = modifier) {
        Box(Modifier.width(1.dp).fillMaxHeight().background(Border))

        // Вне графика — лёгкая заливка
        TimelineLayout.scheduleUnavailable(schedule).forEach { span ->
            SpanBox(span, Modifier.background(OffHoursFill))
        }

        gridTops.forEach { (top, isHour) ->
            val lineModifier = Modifier.offset(y = minutesToDp(top))
            if (isHour) {
                Box(lineModifier.fillMaxWidth().height(1.dp).background(Border))
            } else {
                DashedLine(Border, lineModifier)
            }
        }
        Box(Modifier.offset(y = minutesToDp(TimelineLayout.TOTAL_MINUTES) - 1.dp).fillMaxWidth().height(1.dp).background(Border))

        // Блокировки мастера — серые полосы
        blocks.forEach { block ->
            val span = TimelineLayout.layoutBlock(block, day) ?: return@forEach
            SpanBox(
                span,
                Modifier
                    .padding(horizontal = 3.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(BlockFill),
            ) {
                Text(
                    block.reason?.takeIf { it.isNotBlank() } ?: stringResource(R.string.calendar_block),
                    style = B4UType.Tiny.copy(fontSize = 9.5.sp),
                    color = Muted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                )
            }
        }

        bookings.forEach { booking ->
            val span = TimelineLayout.layoutBooking(booking, day) ?: return@forEach
            val colors = booking.status.colors()
            SpanBox(
                span,
                Modifier
                    .padding(horizontal = 3.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(colors.bg)
                    .clickable { onOpenBooking(booking) },
            ) {
                Row {
                    Box(Modifier.width(3.dp).fillMaxHeight().background(masterColor(booking.masterId)))
                    Column(modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)) {
                        Text(
                            "${PolishDates.time(booking.start.toLocalTime())} · ${catalog.clientName(booking.clientId)}",
                            style = B4UType.Tiny.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold),
                            color = InkStrong,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            catalog.serviceName(booking.serviceId),
                            style = B4UType.Tiny.copy(fontSize = 9.5.sp),
                            color = colors.fg,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SpanBox(span: TimelineSpan, modifier: Modifier, content: @Composable () -> Unit = {}) {
    Box(
        modifier = Modifier
            .offset(y = minutesToDp(span.topMinutes))
            .height(minutesToDp(span.heightMinutes))
            .fillMaxWidth()
            .then(modifier),
    ) { content() }
}
