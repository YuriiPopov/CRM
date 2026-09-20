package com.beauty4you.master.data.repo

import com.beauty4you.master.data.remote.ApiService
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

sealed interface DaySchedule {
    val date: LocalDate

    data class Working(override val date: LocalDate, val startTime: String, val endTime: String) : DaySchedule
    data class Off(override val date: LocalDate) : DaySchedule
    data class NotSet(override val date: LocalDate) : DaySchedule
}

// Читает уже подтверждённый график мастера (GET /master-schedules, теперь разрешён и роли
// MASTER для своего masterId — см. изменение в master-schedules.controller.ts). Предложение
// изменений графика в этой версии не реализовано (см. ScheduleSheetMock) — здесь только чтение.
class ScheduleRepository(private val api: ApiService) {

    suspend fun getWeek(masterId: String, weekStart: LocalDate): List<DaySchedule> {
        val weekDates = (0..6).map { weekStart.plusDays(it.toLong()) }
        val months = weekDates.map { YearMonth.from(it) }.distinct()

        val byDate = mutableMapOf<LocalDate, DaySchedule>()
        for (month in months) {
            val days = api.getMySchedule(masterId, month.year, month.monthValue)
            for (day in days) {
                val date = LocalDate.parse(day.date.substring(0, 10))
                byDate[date] = if (day.isWorking && day.startTime != null && day.endTime != null) {
                    DaySchedule.Working(date, day.startTime, day.endTime)
                } else {
                    DaySchedule.Off(date)
                }
            }
        }

        return weekDates.map { byDate[it] ?: DaySchedule.NotSet(it) }
    }

    companion object {
        fun currentIsoWeekStart(today: LocalDate = LocalDate.now()): LocalDate =
            today.with(DayOfWeek.MONDAY)
    }
}
