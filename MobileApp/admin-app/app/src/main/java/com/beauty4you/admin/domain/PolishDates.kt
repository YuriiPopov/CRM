package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.LocalTime

// Польские названия дней/месяцев заданы явно, а не через Locale("pl"): JDK (unit-тесты) и ICU
// на Android расходятся в падежах и регистре, а дизайну нужен родительный падеж месяца
// ("9 września") и заглавная буква дня ("Wtorek, ...").
object PolishDates {

    private val WEEKDAYS = listOf(
        "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela",
    )
    private val WEEKDAYS_SHORT = listOf("Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie")
    private val MONTHS_GENITIVE = listOf(
        "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
        "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
    )
    private val MONTHS_SHORT = listOf(
        "sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru",
    )

    // "Wtorek, 9 września 2026"
    fun longDate(date: LocalDate): String =
        "${WEEKDAYS[date.dayOfWeek.value - 1]}, ${date.dayOfMonth} ${MONTHS_GENITIVE[date.monthValue - 1]} ${date.year}"

    // "5 września", с годом — только если он не текущий (дата новости, item75)
    fun dayMonth(date: LocalDate, today: LocalDate): String {
        val base = "${date.dayOfMonth} ${MONTHS_GENITIVE[date.monthValue - 1]}"
        return if (date.year == today.year) base else "$base ${date.year}"
    }

    fun weekdayShort(date: LocalDate): String = WEEKDAYS_SHORT[date.dayOfWeek.value - 1]

    // "9 wrz", с годом — только если он не текущий
    fun shortDate(date: LocalDate, today: LocalDate): String {
        val base = "${date.dayOfMonth} ${MONTHS_SHORT[date.monthValue - 1]}"
        return if (date.year == today.year) base else "$base ${date.year}"
    }

    // Подпись даты на карточках визитов: "Dzisiaj" / "Jutro" / "Wczoraj" / "9 wrz"
    fun relativeDay(date: LocalDate, today: LocalDate): String = when (date) {
        today -> "Dzisiaj"
        today.plusDays(1) -> "Jutro"
        today.minusDays(1) -> "Wczoraj"
        else -> shortDate(date, today)
    }

    fun time(time: LocalTime): String = "%02d:%02d".format(time.hour, time.minute)

    // Подпись недели над полосой дней: "5–11 października 2026",
    // "29 września – 5 października 2026", "29 grudnia 2025 – 4 stycznia 2026"
    fun weekRange(weekStart: LocalDate): String {
        val weekEnd = weekStart.plusDays(6)
        val endPart = "${weekEnd.dayOfMonth} ${MONTHS_GENITIVE[weekEnd.monthValue - 1]} ${weekEnd.year}"
        return when {
            weekStart.year != weekEnd.year ->
                "${weekStart.dayOfMonth} ${MONTHS_GENITIVE[weekStart.monthValue - 1]} ${weekStart.year} – $endPart"
            weekStart.month != weekEnd.month ->
                "${weekStart.dayOfMonth} ${MONTHS_GENITIVE[weekStart.monthValue - 1]} – $endPart"
            else -> "${weekStart.dayOfMonth}–$endPart"
        }
    }
}
