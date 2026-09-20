package com.beauty4you.master.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.master.data.repo.DaySchedule
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
import com.beauty4you.master.ui.theme.StatusCancelled
import com.beauty4you.master.ui.theme.getMasterColor
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun ProfileScreen(onLoggedOut: () -> Unit) {
    val container = appContainer()
    val viewModel: ProfileViewModel = viewModel(factory = ProfileViewModel.factory(container))
    val state by viewModel.state.collectAsState()
    var showScheduleSheet by remember { mutableStateOf(false) }

    RefreshOnResume { viewModel.load(silent = true) }

    if (state.loading) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            CircularProgressIndicator()
        }
        return
    }

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
        item { Text(text = "Profil", style = B4UType.ScreenTitle, color = Ink) }

        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MasterAvatar(photoBase64 = state.photoBase64, accentColor = accentColor, size = 64.dp)
                Column(modifier = Modifier.padding(start = 12.dp)) {
                    Text(text = state.name, style = B4UType.IdentityName, color = Ink)
                    Text(text = state.specialtyLine, style = B4UType.Caption, color = Muted)
                }
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard(value = state.totalVisits.toString(), label = "wizyt łącznie", modifier = Modifier.weight(1f))
                StatCard(value = state.rating, label = "ocena", modifier = Modifier.weight(1f))
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(text = "Godziny pracy", style = B4UType.SectionHeader, color = Ink)
                Text(text = weekRangeLabel(state.week), style = B4UType.Caption, color = MutedLight)
            }
        }

        item {
            Card(
                shape = CardShape,
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, Border),
            ) {
                Column {
                    state.week.forEachIndexed { index, day ->
                        WorkHoursRow(day)
                        if (index != state.week.lastIndex) {
                            HorizontalDivider(color = Color(0xFFF5EBEC))
                        }
                    }
                }
            }
        }

        item {
            OutlinedButton(
                onClick = { showScheduleSheet = true },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Ustawienia grafiku pracy")
            }
        }

        item {
            Card(
                shape = CardShape,
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, Border),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Kontakt", style = B4UType.BodyStrong, color = Ink)
                    Text(
                        text = state.email ?: "—",
                        style = B4UType.Body,
                        color = Muted,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
        }

        item {
            OutlinedButton(
                onClick = { viewModel.logout(onLoggedOut) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusCancelled.fg),
                border = BorderStroke(1.dp, StatusCancelled.fg),
            ) {
                Text("Wyloguj się")
            }
        }
    }

    if (showScheduleSheet) {
        ScheduleSheetMock(onDismiss = { showScheduleSheet = false })
    }
}

@Composable
private fun WorkHoursRow(day: DaySchedule) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = day.date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale("pl")).replaceFirstChar { it.uppercase() },
            style = B4UType.Body,
            color = Ink,
            modifier = Modifier.width(88.dp),
        )
        Text(
            text = day.date.format(DateTimeFormatter.ofPattern("dd.MM")),
            style = B4UType.Caption,
            color = MutedLight,
            modifier = Modifier.width(44.dp),
        )
        val label = when (day) {
            is DaySchedule.Working -> "${day.startTime}–${day.endTime}"
            is DaySchedule.Off -> "Wolne"
            is DaySchedule.NotSet -> "Brak grafiku"
        }
        Text(
            text = label,
            style = B4UType.Caption,
            color = Muted,
            modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.End,
        )
    }
}

private fun weekRangeLabel(week: List<DaySchedule>): String {
    if (week.isEmpty()) return ""
    val formatter = DateTimeFormatter.ofPattern("dd.MM")
    return "${week.first().date.format(formatter)}–${week.last().date.format(formatter)}"
}
