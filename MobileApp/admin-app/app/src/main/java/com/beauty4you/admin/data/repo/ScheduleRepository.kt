package com.beauty4you.admin.data.repo

import com.beauty4you.admin.data.remote.ApiService
import com.beauty4you.admin.data.remote.CreateBlockBody
import com.beauty4you.admin.data.remote.toBody
import com.beauty4you.admin.data.remote.toDomain
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.MasterBlock
import com.beauty4you.admin.domain.ScheduleDay
import com.beauty4you.admin.domain.ScheduleMonthPlan
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.time.LocalDate
import java.time.YearMonth

// То, что нужно шторке «Grafik pracy» — интерфейс, чтобы гонки ответов проверялись в unit-тестах
interface MasterScheduleSource {
    suspend fun monthsFor(masterId: String, months: List<YearMonth>): List<ScheduleDay>
    suspend fun conflicts(masterId: String, plan: ScheduleMonthPlan): List<Booking>
    suspend fun save(masterId: String, plan: ScheduleMonthPlan): List<ScheduleDay>
}

// То же для шторки «Blokady»
interface MasterBlocksSource {
    suspend fun blocksOf(masterId: String, from: LocalDate): List<MasterBlock>
    suspend fun createBlock(masterId: String, startTime: String, endTime: String, reason: String): MasterBlock
    suspend fun deleteBlock(id: String)
}

class ScheduleRepository(private val api: ApiService) : MasterScheduleSource, MasterBlocksSource {

    // График нескольких мастеров на набор дат. GET /master-schedules отдаёт один месяц одного
    // мастера — запрашиваем каждую пару (мастер, месяц) один раз.
    suspend fun scheduleFor(masterIds: List<String>, dates: List<LocalDate>): Map<Pair<String, LocalDate>, ScheduleDay> {
        val months = dates.map { YearMonth.from(it) }.distinct()
        val wanted = dates.toSet()
        return coroutineScope {
            masterIds.flatMap { masterId ->
                months.map { month ->
                    async { api.getSchedule(masterId, month.year, month.monthValue).map { it.toDomain() } }
                }
            }.awaitAll()
        }
            .flatten()
            .filter { it.date in wanted }
            .associateBy { it.masterId to it.date }
    }

    // Блокировки всех мастеров, пересекающие [from, to) — по суткам, салонное время с меткой UTC
    suspend fun blocks(from: LocalDate, toExclusive: LocalDate): List<MasterBlock> =
        api.listBlocks("${from}T00:00:00.000Z", "${toExclusive}T00:00:00.000Z").map { it.toDomain() }

    // --- Редактирование графика и блокировок (item76, часть 2) ---

    // График одного мастера за несколько месяцев (неделя может захватить два)
    override suspend fun monthsFor(masterId: String, months: List<YearMonth>): List<ScheduleDay> = coroutineScope {
        months.map { month -> async { api.getSchedule(masterId, month.year, month.monthValue).map { it.toDomain() } } }
            .awaitAll()
            .flatten()
    }

    // Неизвестный этой версии статус записи даёт null (как в списках) — такая запись не покажется
    override suspend fun conflicts(masterId: String, plan: ScheduleMonthPlan): List<Booking> =
        api.scheduleConflicts(plan.toBody(masterId)).mapNotNull { it.toDomain() }

    override suspend fun save(masterId: String, plan: ScheduleMonthPlan): List<ScheduleDay> =
        api.saveSchedule(plan.toBody(masterId)).map { it.toDomain() }

    // Блокировки мастера, заканчивающиеся после from (полночь дня, салонное время с меткой UTC)
    override suspend fun blocksOf(masterId: String, from: LocalDate): List<MasterBlock> =
        api.listBlocks(from = "${from}T00:00:00.000Z", masterId = masterId).map { it.toDomain() }

    override suspend fun createBlock(masterId: String, startTime: String, endTime: String, reason: String): MasterBlock =
        api.createBlock(CreateBlockBody(masterId, startTime, endTime, reason)).toDomain()

    override suspend fun deleteBlock(id: String) = api.deleteBlock(id)
}
