package com.beauty4you.master.ui.common

import com.beauty4you.master.data.model.BookingStatus
import com.beauty4you.master.ui.theme.StatusCancelled
import com.beauty4you.master.ui.theme.StatusColors
import com.beauty4you.master.ui.theme.StatusConfirmed
import com.beauty4you.master.ui.theme.StatusDone
import com.beauty4you.master.ui.theme.StatusNoShow
import com.beauty4you.master.ui.theme.StatusPending

// Маппинг backend BookingStatus (см. schema.prisma enum BookingStatus) на дизайн пилюль из
// design_handoff_master_app/README.md. NO_SHOW — «Nieobecna» (item74), цвета из дизайна admin-app.
fun BookingStatus.label(): String = when (this) {
    BookingStatus.CREATED -> "Oczekująca"
    BookingStatus.CONFIRMED -> "Potwierdzona"
    BookingStatus.COMPLETED -> "Zakończona"
    BookingStatus.CANCELLED -> "Anulowana"
    BookingStatus.NO_SHOW -> "Nieobecna"
}

fun BookingStatus.colors(): StatusColors = when (this) {
    BookingStatus.CREATED -> StatusPending
    BookingStatus.CONFIRMED -> StatusConfirmed
    BookingStatus.COMPLETED -> StatusDone
    BookingStatus.CANCELLED -> StatusCancelled
    BookingStatus.NO_SHOW -> StatusNoShow
}
