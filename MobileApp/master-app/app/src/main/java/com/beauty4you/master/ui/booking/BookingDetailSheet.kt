package com.beauty4you.master.ui.booking

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.master.ui.common.StatusPill
import com.beauty4you.master.ui.common.appContainer
import com.beauty4you.master.ui.theme.AppBackground
import com.beauty4you.master.ui.theme.B4UType
import com.beauty4you.master.ui.theme.Ink
import com.beauty4you.master.ui.theme.Muted
import java.time.format.DateTimeFormatter
import java.util.Locale

// Read-only — статус выставляет администратор, мастер только смотрит (см. README дизайна:
// "Status wizyty ustala administrator"). PATCH /bookings/:id/status формально уже разрешён роли
// MASTER на бэкенде, но в этом приложении сознательно не даём мастеру менять статус.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingDetailSheet(appointmentId: String, onDismiss: () -> Unit) {
    val container = appContainer()
    val viewModel: BookingDetailViewModel = viewModel(factory = BookingDetailViewModel.factory(container))
    val state by viewModel.state.collectAsState()

    LaunchedEffect(appointmentId) { viewModel.load(appointmentId) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AppBackground) {
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
            when {
                state.loading -> CircularProgressIndicator()
                state.appointment != null -> {
                    val appointment = state.appointment!!
                    Text(text = appointment.serviceName, style = B4UType.SectionHeader, color = Ink)
                    Text(
                        text = "${appointment.date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("pl")))} · " +
                            "${appointment.startTime.format(DateTimeFormatter.ofPattern("HH:mm"))}–" +
                            appointment.endTime.format(DateTimeFormatter.ofPattern("HH:mm")),
                        style = B4UType.Body,
                        color = Muted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(text = appointment.clientName, style = B4UType.ServiceName, color = Ink, modifier = Modifier.padding(top = 12.dp))

                    StatusPill(status = appointment.status, modifier = Modifier.padding(top = 12.dp))

                    Text(
                        text = "Status wizyty ustala administrator",
                        style = B4UType.Caption,
                        color = Muted,
                        modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
                    )
                }
                else -> Text(text = state.error ?: "Błąd", style = B4UType.Body, color = Muted)
            }
        }
    }
}
