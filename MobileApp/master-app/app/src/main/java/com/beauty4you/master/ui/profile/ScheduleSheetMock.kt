package com.beauty4you.master.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import android.widget.Toast
import com.beauty4you.master.ui.theme.AppBackground
import com.beauty4you.master.ui.theme.B4UType
import com.beauty4you.master.ui.theme.Ink
import com.beauty4you.master.ui.theme.Muted
import com.beauty4you.master.ui.theme.StatusCancelled
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

// Статичный визуальный макет раздела "Ustawienia grafiku pracy" — по решению пользователя, в
// этой версии предложение/согласование графика НЕ реализуется по-настоящему (нет approval
// workflow в бэкенде). Шторка открывается и выглядит как в дизайне, тап по дням месяца — только
// локальный UI-стейт, ничего не сохраняется и не отправляется на сервер. Полная реализация —
// в следующей версии.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleSheetMock(onDismiss: () -> Unit) {
    val context = LocalContext.current
    var monthOffset by remember { mutableStateOf(0) }
    val month = remember(monthOffset) { YearMonth.now().plusMonths(monthOffset.toLong()) }
    var selectedDates by remember { mutableStateOf(setOf<LocalDate>()) }
    var startHour by remember { mutableStateOf("09:00") }
    var endHour by remember { mutableStateOf("19:00") }

    fun notAvailableYet() {
        Toast.makeText(context, "Dostępne w kolejnej wersji", Toast.LENGTH_SHORT).show()
    }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AppBackground) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
            Text(text = "Grafik pracy", style = B4UType.SectionHeader, color = Ink)
            Text(
                text = "Wybierz jeden lub kilka dni, aby ustawić godziny pracy lub oznaczyć jako wolne",
                style = B4UType.Body,
                color = Muted,
                modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { monthOffset -= 1 }) {
                    Icon(Icons.Filled.ChevronLeft, contentDescription = null)
                }
                Text(
                    text = "${monthName(month)} ${month.year}",
                    style = B4UType.BodyStrong,
                    color = Ink,
                )
                IconButton(onClick = { monthOffset += 1 }) {
                    Icon(Icons.Filled.ChevronRight, contentDescription = null)
                }
            }

            Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                DayOfWeek.entries.forEach { day ->
                    Text(
                        text = day.getDisplayName(TextStyle.SHORT, Locale("pl")).replaceFirstChar { it.uppercase() },
                        style = B4UType.Caption,
                        color = Muted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            val firstOfMonth = month.atDay(1)
            val leadingBlanks = (firstOfMonth.dayOfWeek.value - DayOfWeek.MONDAY.value + 7) % 7
            val daysInMonth = month.lengthOfMonth()
            val cells: List<LocalDate?> = List(leadingBlanks) { null } + (1..daysInMonth).map { month.atDay(it) }

            LazyVerticalGrid(
                columns = GridCells.Fixed(7),
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            ) {
                items(cells) { date ->
                    Box(
                        modifier = Modifier
                            .aspectRatio(1f)
                            .padding(2.dp)
                            .clip(CircleShape)
                            .then(
                                if (date != null && selectedDates.contains(date)) {
                                    Modifier.background(Ink)
                                } else {
                                    Modifier
                                },
                            )
                            .then(
                                if (date != null) {
                                    Modifier.clickable {
                                        selectedDates = if (selectedDates.contains(date)) {
                                            selectedDates - date
                                        } else {
                                            selectedDates + date
                                        }
                                    }
                                } else {
                                    Modifier
                                },
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (date != null) {
                            Text(
                                text = date.dayOfMonth.toString(),
                                style = B4UType.Body,
                                color = if (selectedDates.contains(date)) AppBackground else Ink,
                            )
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = startHour,
                    onValueChange = { startHour = it },
                    label = { Text("OD") },
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = endHour,
                    onValueChange = { endHour = it },
                    label = { Text("DO") },
                    modifier = Modifier.weight(1f),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Button(
                    onClick = { notAvailableYet() },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color(0xFF3F9C5C)),
                ) {
                    Text("Ustaw godziny")
                }
                OutlinedButton(
                    onClick = { notAvailableYet() },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusCancelled.fg),
                    border = androidx.compose.foundation.BorderStroke(1.dp, StatusCancelled.fg),
                ) {
                    Text("Oznacz jako wolne")
                }
            }

            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Ink),
            ) {
                Text("Zapisz i zamknij")
            }
        }
    }
}

private fun monthName(month: YearMonth): String =
    month.month.getDisplayName(TextStyle.FULL, Locale("pl")).replaceFirstChar { it.uppercase() }
