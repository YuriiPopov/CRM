package com.beauty4you.admin.ui.common

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.B4UAdminApp
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.BookingError
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.ui.theme.StatusCancelled
import com.beauty4you.admin.ui.theme.StatusColors
import com.beauty4you.admin.ui.theme.StatusConfirmed
import com.beauty4you.admin.ui.theme.StatusDone
import com.beauty4you.admin.ui.theme.StatusNoShow
import com.beauty4you.admin.ui.theme.StatusPending

@Composable
fun appContainer(): AppContainer = (LocalContext.current.applicationContext as B4UAdminApp).container

// Статусы и цвета — по таблице ТЗ item73 (дизайн -> backend); «Nieobecna» — item74.
@StringRes
fun BookingStatus.labelRes(): Int = when (this) {
    BookingStatus.CREATED -> R.string.status_created
    BookingStatus.CONFIRMED -> R.string.status_confirmed
    BookingStatus.COMPLETED -> R.string.status_completed
    BookingStatus.CANCELLED -> R.string.status_cancelled
    BookingStatus.NO_SHOW -> R.string.status_no_show
}

fun BookingStatus.colors(): StatusColors = when (this) {
    BookingStatus.CREATED -> StatusPending
    BookingStatus.CONFIRMED -> StatusConfirmed
    BookingStatus.COMPLETED -> StatusDone
    BookingStatus.CANCELLED -> StatusCancelled
    BookingStatus.NO_SHOW -> StatusNoShow
}

@StringRes
fun BookingError.messageRes(): Int = when (this) {
    BookingError.OVERLAP -> R.string.error_overlap
    BookingError.MASTER_BLOCKED -> R.string.error_master_blocked
    BookingError.DAY_OFF -> R.string.error_day_off
    BookingError.OUTSIDE_HOURS -> R.string.error_outside_hours
    BookingError.PAST_TIME -> R.string.error_past_time
    BookingError.INVALID_TRANSITION -> R.string.error_invalid_transition
    BookingError.NO_SHOW_TOO_EARLY -> R.string.error_no_show_too_early
    BookingError.NOT_RESCHEDULABLE -> R.string.error_not_reschedulable
    BookingError.NOT_FOUND -> R.string.error_not_found
    BookingError.VALIDATION -> R.string.error_validation
    BookingError.NETWORK -> R.string.error_network
    BookingError.UNKNOWN -> R.string.error_unknown
}
