package com.beauty4you.master.ui.calendar

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.master.data.repo.Appointment
import com.beauty4you.master.ui.common.EmptyState
import com.beauty4you.master.ui.common.RefreshOnResume
import com.beauty4you.master.ui.common.StatusPill
import com.beauty4you.master.ui.common.appContainer
import com.beauty4you.master.ui.common.label
import com.beauty4you.master.ui.theme.B4UType
import com.beauty4you.master.ui.theme.Border
import com.beauty4you.master.ui.theme.CardBg
import com.beauty4you.master.ui.theme.CardShape
import com.beauty4you.master.ui.theme.Ink
import com.beauty4you.master.ui.theme.Muted
import com.beauty4you.master.ui.theme.MutedLight
import com.beauty4you.master.ui.theme.getMasterColor
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(onAppointmentClick: (String) -> Unit) {
    val container = appContainer()
    val viewModel: CalendarViewModel = viewModel(factory = CalendarViewModel.factory(container))
    val state by viewModel.state.collectAsState()

    RefreshOnResume { viewModel.load(silent = true) }

    if (state.loading) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            CircularProgressIndicator()
        }
        return
    }

    if (state.error != null && state.allAppointments.isEmpty()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(text = state.error ?: "Błąd", style = B4UType.Body, color = Muted)
            androidx.compose.material3.TextButton(onClick = { viewModel.load() }) {
                Text("Spróbuj ponownie")
            }
        }
        return
    }

    val accentColor = state.masterId?.let { getMasterColor(it) } ?: Ink

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(text = "Kalendarz", style = B4UType.ScreenTitle, color = Ink)
        Text(text = "Twoje wizyty", style = B4UType.Body, color = Muted, modifier = Modifier.padding(top = 2.dp, bottom = 16.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            state.weekDates.forEach { date ->
                val selected = date == state.selectedDate
                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selected) Color(0xFFF3E7E4) else Color.Transparent)
                        .clickable { viewModel.selectDate(date) }
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale("pl")).replaceFirstChar { it.uppercase() },
                        style = B4UType.Caption,
                        color = if (selected) Color(0xFFC9445A) else Muted,
                    )
                    Text(
                        text = date.dayOfMonth.toString(),
                        style = B4UType.BodyStrong,
                        color = if (selected) Color(0xFFC9445A) else Ink,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = state.viewMode == CalendarViewMode.LIST,
                onClick = { viewModel.setViewMode(CalendarViewMode.LIST) },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
            ) { Text("Lista") }
            SegmentedButton(
                selected = state.viewMode == CalendarViewMode.TIMELINE,
                onClick = { viewModel.setViewMode(CalendarViewMode.TIMELINE) },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
            ) { Text("Timeline") }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(CardBg)
                .border(BorderStroke(1.dp, Border), RoundedCornerShape(999.dp))
                .clickable { viewModel.cycleStatusFilter() }
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Text(
                text = "Status: ${state.statusFilter?.label() ?: "Wszystkie"}",
                style = B4UType.Caption,
                color = Ink,
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        val dayAppointments = state.dayAppointments

        when (state.viewMode) {
            CalendarViewMode.LIST -> {
                if (dayAppointments.isEmpty()) {
                    EmptyState(text = "Brak wizyt")
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(bottom = 16.dp),
                    ) {
                        items(dayAppointments) { appointment ->
                            CalendarListRow(
                                appointment = appointment,
                                accentColor = accentColor,
                                onClick = { onAppointmentClick(appointment.id) },
                            )
                        }
                    }
                }
            }
            CalendarViewMode.TIMELINE -> {
                if (dayAppointments.isEmpty()) {
                    EmptyState(text = "Brak wizyt")
                } else {
                    TimelineView(
                        appointments = dayAppointments,
                        accentColor = accentColor,
                        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                        daySchedule = state.selectedDaySchedule,
                        onAppointmentClick = onAppointmentClick,
                    )
                }
            }
        }
    }
}

@Composable
private fun CalendarListRow(
    appointment: Appointment,
    accentColor: Color,
    onClick: () -> Unit,
) {
    Card(
        shape = CardShape,
        colors = CardDefaults.cardColors(containerColor = CardBg),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(modifier = Modifier.padding(vertical = 12.dp, horizontal = 12.dp)) {
            Box(modifier = Modifier.size(width = 3.dp, height = 36.dp).background(accentColor))
            Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                Text(text = appointment.serviceName, style = B4UType.ServiceName, color = Ink, maxLines = 1)
                Text(text = appointment.clientName, style = B4UType.Caption, color = Muted, maxLines = 1)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = appointment.startTime.format(DateTimeFormatter.ofPattern("HH:mm")),
                    style = B4UType.Caption,
                    color = MutedLight,
                )
                Spacer(modifier = Modifier.height(4.dp))
                StatusPill(status = appointment.status)
            }
        }
    }
}
