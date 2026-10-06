package com.beauty4you.admin.domain

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth

// График работы мастера (item76, часть 2) — чистый Kotlin, проверяется JVM unit-тестами.
// Бэкенд хранит график по конкретным датам и принимает его помесячно (PUT /master-schedules и
// POST /master-schedules/conflicts с year/month/days) — в приложении это неделя с листанием,
// правки копятся по датам и при сохранении раскладываются по месяцам.

// UNSET — день ещё не размечен (записи MasterSchedule нет); это не «выходной», см. ScheduleDay.
// Вернуть день в UNSET из приложения нельзя: API умеет только «рабочий» / «выходной».
enum class DayStatus { UNSET, WORKING, OFF }

data class DaySchedule(
    val status: DayStatus,
    val start: LocalTime = ScheduleLogic.DEFAULT_START,
    val end: LocalTime = ScheduleLogic.DEFAULT_END,
)

enum class HoursError { START_NOT_BEFORE_END, OUT_OF_RANGE }

// Один месяц для PUT /master-schedules (и того же тела POST /conflicts)
data class ScheduleMonthPlan(val month: YearMonth, val days: List<ScheduleDayInput>)

data class ScheduleDayInput(val date: LocalDate, val isWorking: Boolean, val start: LocalTime? = null, val end: LocalTime? = null)

// Почему запись конфликтует с новым графиком: попадает на новый выходной или выходит за новые часы
enum class ConflictReason { DAY_OFF, OUTSIDE_HOURS }

// Запись из ответа POST /master-schedules/conflicts вместе с причиной конфликта
data class BookingConflict(val booking: Booking, val reason: ConflictReason)

// Строка списка конфликтов: запись, конфликтующая с новым графиком
data class ScheduleConflict(
    val bookingId: String,
    val date: LocalDate,
    val start: LocalTime,
    val clientName: String,
    val serviceName: String,
    val reason: ConflictReason = ConflictReason.DAY_OFF,
)

enum class ScheduleError { VALIDATION, NOT_FOUND, NETWORK, UNKNOWN }

object ScheduleLogic {
    // По умолчанию — часы салона, как в веб-CRM (DEFAULT_START_TIME/DEFAULT_END_TIME, item53)
    val DEFAULT_START: LocalTime = LocalTime.of(9, 0)
    val DEFAULT_END: LocalTime = LocalTime.of(19, 0)

    // Допустимые часы в графике и блокировках (ТЗ item76): с 06:00 до 22:00, шаг выбора 15 минут
    val EARLIEST: LocalTime = LocalTime.of(6, 0)
    val LATEST: LocalTime = LocalTime.of(22, 0)
    const val STEP_MINUTES = 15L

    fun timeOptions(): List<LocalTime> =
        generateSequence(EARLIEST) { it.plusMinutes(STEP_MINUTES) }.takeWhile { !it.isAfter(LATEST) }.toList()

    fun validateHours(start: LocalTime, end: LocalTime): HoursError? = when {
        start.isBefore(EARLIEST) || end.isAfter(LATEST) -> HoursError.OUT_OF_RANGE
        !start.isBefore(end) -> HoursError.START_NOT_BEFORE_END
        else -> null
    }

    fun weekStart(date: LocalDate): LocalDate = date.minusDays((date.dayOfWeek.value - DayOfWeek.MONDAY.value).toLong())

    fun weekDates(weekStart: LocalDate): List<LocalDate> = (0L..6L).map { weekStart.plusDays(it) }

    // Месяцы, которые нужно загрузить для недели (неделя может захватывать два месяца)
    fun monthsOf(dates: List<LocalDate>): List<YearMonth> = dates.map { YearMonth.from(it) }.distinct()

    // Состояние дней по ответу GET /master-schedules; дни без записи — UNSET
    fun fromServer(dates: List<LocalDate>, records: List<ScheduleDay>): Map<LocalDate, DaySchedule> {
        val byDate = records.associateBy { it.date }
        return dates.associateWith { date ->
            val record = byDate[date]
            when {
                record == null -> DaySchedule(DayStatus.UNSET)
                record.isWorking -> DaySchedule(
                    DayStatus.WORKING,
                    record.startTime ?: DEFAULT_START,
                    record.endTime ?: DEFAULT_END,
                )
                else -> DaySchedule(DayStatus.OFF)
            }
        }
    }

    // --- Выбор нескольких дней (как «Множественный выбор» в веб-CRM, item54) ---

    fun toggleSelection(selected: Set<LocalDate>, date: LocalDate): Set<LocalDate> =
        if (date in selected) selected - date else selected + date

    // «Zaznacz wszystkie» на неделе; если вся неделя уже выбрана — снимает выбор с неё
    fun toggleWeek(selected: Set<LocalDate>, week: List<LocalDate>): Set<LocalDate> =
        if (selected.containsAll(week)) selected - week.toSet() else selected + week

    // Одно и то же состояние сразу для всех выбранных дней. Часы проверяет validateHours заранее.
    fun applyToSelected(
        states: Map<LocalDate, DaySchedule>,
        selected: Set<LocalDate>,
        day: DaySchedule,
    ): Map<LocalDate, DaySchedule> = states + selected.associateWith { day }

    // --- Сохранение ---

    // Дни, отличающиеся от загруженного графика. Выходной сравнивается без часов (бэкенд их обнуляет).
    fun changedDays(loaded: Map<LocalDate, DaySchedule>, edited: Map<LocalDate, DaySchedule>): Map<LocalDate, DaySchedule> =
        edited.filter { (date, day) -> day.status != DayStatus.UNSET && !sameDay(loaded[date], day) }

    fun isDirty(loaded: Map<LocalDate, DaySchedule>, edited: Map<LocalDate, DaySchedule>): Boolean =
        changedDays(loaded, edited).isNotEmpty()

    // Изменённые дни, разложенные по месяцам по возрастанию дат — по запросу на месяц
    fun planSave(changed: Map<LocalDate, DaySchedule>): List<ScheduleMonthPlan> =
        changed.entries
            .sortedBy { it.key }
            .groupBy({ YearMonth.from(it.key) }) { (date, day) ->
                if (day.status == DayStatus.WORKING) {
                    ScheduleDayInput(date, isWorking = true, start = day.start, end = day.end)
                } else {
                    ScheduleDayInput(date, isWorking = false)
                }
            }
            .map { (month, days) -> ScheduleMonthPlan(month, days) }

    // Ответ POST /master-schedules/conflicts — записи (Booking) мастера на новых выходных и за
    // новыми часами работы. Запросов по месяцу может быть два — убираем повторы, сортируем по времени.
    fun conflicts(
        bookings: List<BookingConflict>,
        clientName: (String) -> String,
        serviceName: (String) -> String,
    ): List<ScheduleConflict> =
        bookings
            .distinctBy { it.booking.id }
            .sortedBy { it.booking.start }
            .map { (b, reason) ->
                ScheduleConflict(b.id, b.date, b.start.toLocalTime(), clientName(b.clientId), serviceName(b.serviceId), reason)
            }

    // Старый бэкенд reason не присылал и отдавал только записи на выходных
    fun conflictReason(raw: String?): ConflictReason =
        if (raw == "OUTSIDE_HOURS") ConflictReason.OUTSIDE_HOURS else ConflictReason.DAY_OFF

    fun mapError(httpCode: Int?): ScheduleError = when (httpCode) {
        null -> ScheduleError.NETWORK
        400 -> ScheduleError.VALIDATION
        404 -> ScheduleError.NOT_FOUND
        else -> ScheduleError.UNKNOWN
    }

    private fun sameDay(a: DaySchedule?, b: DaySchedule): Boolean = when {
        a == null -> false
        a.status != b.status -> false
        a.status == DayStatus.WORKING -> a.start == b.start && a.end == b.end
        else -> true
    }
}
