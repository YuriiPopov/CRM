package com.beauty4you.master.ui.common

import com.beauty4you.master.data.model.BookingStatus
import com.beauty4you.master.ui.theme.StatusCancelled
import com.beauty4you.master.ui.theme.StatusColors
import com.beauty4you.master.ui.theme.StatusConfirmed
import com.beauty4you.master.ui.theme.StatusDone
import com.beauty4you.master.ui.theme.StatusPending

// Маппинг backend BookingStatus (CREATED/CONFIRMED/COMPLETED/CANCELLED — см. schema.prisma enum
// BookingStatus, в дизайне нет статуса no_show — его в схеме тоже нет, не реализуем) на дизайн
// пилюль из design_handoff_master_app/README.md.
fun BookingStatus.label(): String = when (this) {
    BookingStatus.CREATED -> "Oczekująca"
    BookingStatus.CONFIRMED -> "Potwierdzona"
    BookingStatus.COMPLETED -> "Zakończona"
    BookingStatus.CANCELLED -> "Anulowana"
}

fun BookingStatus.colors(): StatusColors = when (this) {
    BookingStatus.CREATED -> StatusPending
    BookingStatus.CONFIRMED -> StatusConfirmed
    BookingStatus.COMPLETED -> StatusDone
    BookingStatus.CANCELLED -> StatusCancelled
}
