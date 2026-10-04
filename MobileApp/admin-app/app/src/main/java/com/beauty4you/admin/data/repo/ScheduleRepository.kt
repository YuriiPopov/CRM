package com.beauty4you.admin.data.repo

import com.beauty4you.admin.data.remote.ApiService
import com.beauty4you.admin.data.remote.toDomain
import com.beauty4you.admin.domain.MasterBlock
import com.beauty4you.admin.domain.ScheduleDay
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.time.LocalDate
import java.time.YearMonth

class ScheduleRepository(private val api: ApiService) {

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
}
