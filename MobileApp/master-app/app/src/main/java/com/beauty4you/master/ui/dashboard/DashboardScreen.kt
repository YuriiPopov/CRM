package com.beauty4you.master.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.master.ui.common.AppointmentRow
import com.beauty4you.master.ui.common.EmptyState
import com.beauty4you.master.ui.common.MasterAvatar
import com.beauty4you.master.ui.common.RefreshOnResume
import com.beauty4you.master.ui.common.StatCard
import com.beauty4you.master.ui.common.appContainer
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

@Composable
fun DashboardScreen(onAppointmentClick: (String) -> Unit) {
    val container = appContainer()
    val viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.factory(container))
    val state by viewModel.state.collectAsState()

    RefreshOnResume { viewModel.load(silent = true) }

    if (state.loading) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            CircularProgressIndicator()
        }
        return
    }

    // masterId == null здесь означает, что load() упал ещё до сборки успешного состояния (см.
    // DashboardViewModel.load) — без этого экран выглядел бы просто "пустым", как в баге, из-за
    // которого рассинхронились форма ответа GET /staff/:id и Kotlin-модель MasterDetailDto.
    if (state.error != null && state.masterId == null) {
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

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column {
                    Text(text = "Cześć, ${state.masterName}", style = B4UType.ScreenTitle, color = Ink)
                    Text(
                        text = formatFullDate(state.today),
                        style = B4UType.ScreenSubtitleSerif,
                        color = MutedLight,
                    )
                }
                MasterAvatar(photoBase64 = state.photoBase64, accentColor = accentColor, size = 56.dp)
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard(value = state.todayCount.toString(), label = "wizyt dziś", modifier = Modifier.weight(1f))
                StatCard(value = state.weekCount.toString(), label = "wizyt w tyg.", modifier = Modifier.weight(1f))
                StatCard(value = state.completedCount.toString(), label = "zakończonych", modifier = Modifier.weight(1f))
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(text = "Dzisiaj", style = B4UType.SectionHeader, color = Ink)
                Text(text = "${state.todaysAppointments.size} wizyt", style = B4UType.Caption, color = MutedLight)
            }
        }

        if (state.todaysAppointments.isEmpty()) {
            item { EmptyState(text = "Brak wizyt na dziś") }
        } else {
            item {
                Card(
                    shape = CardShape,
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                ) {
                    Column {
                        state.todaysAppointments.forEachIndexed { index, appointment ->
                            AppointmentRow(
                                time = appointment.startTime.format(DateTimeFormatter.ofPattern("HH:mm")),
                                serviceName = appointment.serviceName,
                                clientName = appointment.clientName,
                                status = appointment.status,
                                accentColor = accentColor,
                                onClick = { onAppointmentClick(appointment.id) },
                            )
                            if (index != state.todaysAppointments.lastIndex) {
                                androidx.compose.material3.HorizontalDivider(color = androidx.compose.ui.graphics.Color(0xFFF5EBEC))
                            }
                        }
                    }
                }
            }
        }

        item {
            Text(text = "Tydzień", style = B4UType.SectionHeader, color = Ink, modifier = Modifier.padding(top = 4.dp))
        }
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                state.weekDates.forEach { date ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale("pl")).replaceFirstChar { it.uppercase() },
                            style = B4UType.Caption,
                            color = Muted,
                        )
                        Text(text = date.dayOfMonth.toString(), style = B4UType.BodyStrong, color = Ink)
                        // Полоска — индикатор "в этот день есть записи", а не декорация под каждым
                        // днём подряд (см. weekDatesWithAppointments в DashboardViewModel).
                        val hasAppointments = date in state.weekDatesWithAppointments
                        Box(
                            modifier = Modifier
                                .padding(top = 4.dp)
                                .size(width = 16.dp, height = 4.dp)
                                .background(
                                    if (hasAppointments) accentColor else Color.Transparent,
                                    RoundedCornerShape(2.dp),
                                ),
                        )
                    }
                }
            }
        }
    }
}

private fun formatFullDate(date: java.time.LocalDate): String {
    val formatted = date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("pl")))
    val dayName = date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale("pl"))
    return "${dayName.replaceFirstChar { it.uppercase() }}, $formatted"
}
