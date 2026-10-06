package com.beauty4you.admin.ui.more

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.AppEvents
import com.beauty4you.admin.R
import com.beauty4you.admin.data.remote.toApiFailure
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.data.repo.MasterScheduleSource
import com.beauty4you.admin.domain.DaySchedule
import com.beauty4you.admin.domain.DayStatus
import com.beauty4you.admin.domain.HoursError
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.ScheduleConflict
import com.beauty4you.admin.domain.ScheduleError
import com.beauty4you.admin.domain.ScheduleLogic
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth

data class ScheduleUiState(
    val master: Master? = null,
    val weekStart: LocalDate = ScheduleLogic.weekStart(LocalDate.now()),
    val loadedMonths: Set<YearMonth> = emptySet(),
    val loading: Boolean = true,
    val loadError: Boolean = false,
    // График с сервера и правки поверх него — по датам всех загруженных месяцев
    val loaded: Map<LocalDate, DaySchedule> = emptyMap(),
    val edited: Map<LocalDate, DaySchedule> = emptyMap(),
    // Выбранные дни и панель «применить к выбранным» (как «Множественный выбор» в веб-CRM, item54)
    val selected: Set<LocalDate> = emptySet(),
    val bulkWorking: Boolean = true,
    val bulkStart: LocalTime = ScheduleLogic.DEFAULT_START,
    val bulkEnd: LocalTime = ScheduleLogic.DEFAULT_END,
    val hoursError: HoursError? = null,
    val saving: Boolean = false,
    val error: ScheduleError? = null,
    // Не пусто — записи на днях, которые станут выходными: сохраняем только после подтверждения
    val conflicts: List<ScheduleConflict> = emptyList(),
    val closed: Boolean = false,
) {
    val week: List<LocalDate> get() = ScheduleLogic.weekDates(weekStart)
    val changed: Map<LocalDate, DaySchedule> get() = ScheduleLogic.changedDays(loaded, edited)
    val isDirty: Boolean get() = ScheduleLogic.isDirty(loaded, edited)
}

// «Grafik pracy» мастера (item76, часть 2): неделя с листанием, выбор нескольких дней,
// перед сохранением — POST /master-schedules/conflicts, затем PUT по каждому месяцу.
class ScheduleViewModel(
    private val repository: MasterScheduleSource,
    private val loadCatalog: suspend () -> Catalog,
    private val events: AppEvents,
) : ViewModel() {

    private val _state = MutableStateFlow(ScheduleUiState())
    val state: StateFlow<ScheduleUiState> = _state.asStateFlow()

    private var loadJob: Job? = null

    // Тот же мастер — шторка пересоздана вместе с Activity (поворот, смена темы): черновик остаётся
    fun start(master: Master) {
        if (_state.value.master?.id == master.id) return
        loadJob?.cancel()
        _state.value = ScheduleUiState(master = master)
        loadWeek()
    }

    // Шторка закрыта: загрузка отменяется, состояние сбрасывается, иначе при следующем открытии старый
    // closed = true сразу закрыл бы её снова (ViewModel живёт дольше шторки — в записи навигации экрана)
    fun reset() {
        loadJob?.cancel()
        _state.value = ScheduleUiState()
    }

    fun retry() = loadWeek()

    fun previousWeek() = moveWeek(-1)

    fun nextWeek() = moveWeek(1)

    fun toggleDay(date: LocalDate) =
        _state.update { it.copy(selected = ScheduleLogic.toggleSelection(it.selected, date), hoursError = null) }

    fun toggleWeek() = _state.update { it.copy(selected = ScheduleLogic.toggleWeek(it.selected, it.week), hoursError = null) }

    fun setBulkWorking(working: Boolean) = _state.update { it.copy(bulkWorking = working, hoursError = null) }

    fun setBulkStart(time: LocalTime) = _state.update { it.copy(bulkStart = time, hoursError = null) }

    fun setBulkEnd(time: LocalTime) = _state.update { it.copy(bulkEnd = time, hoursError = null) }

    // Применить «Pracuje od–do» или «Wolne» ко всем выбранным дням. Выбор не сбрасывается —
    // можно сразу уточнить часы (как в веб-CRM).
    fun applyToSelected() {
        val s = _state.value
        if (s.selected.isEmpty()) return
        val day = if (s.bulkWorking) {
            ScheduleLogic.validateHours(s.bulkStart, s.bulkEnd)?.let { error ->
                _state.update { it.copy(hoursError = error) }
                return
            }
            DaySchedule(DayStatus.WORKING, s.bulkStart, s.bulkEnd)
        } else {
            DaySchedule(DayStatus.OFF)
        }
        _state.update {
            it.copy(
                edited = ScheduleLogic.applyToSelected(it.edited, it.selected, day),
                hoursError = null,
                error = null,
                conflicts = emptyList(),
            )
        }
    }

    fun save(confirmed: Boolean = false) {
        val s = _state.value
        val master = s.master ?: return
        if (s.saving) return
        val plans = ScheduleLogic.planSave(s.changed)
        if (plans.isEmpty()) {
            _state.update { it.copy(closed = true) }
            return
        }
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            try {
                if (!confirmed) {
                    val bookings = plans.flatMap { repository.conflicts(master.id, it) }
                    if (bookings.isNotEmpty()) {
                        val catalog = loadCatalog()
                        val rows = ScheduleLogic.conflicts(bookings, catalog::clientName, catalog::serviceName)
                        updateFor(master) { it.copy(saving = false, conflicts = rows) }
                        return@launch
                    }
                }
                plans.forEach { plan ->
                    repository.save(master.id, plan)
                    // Месяц сохранён: при ошибке на следующем повторное «Zapisz» его уже не отправит
                    val savedDates = plan.days.map { it.date }.toSet()
                    updateFor(master) { st -> st.copy(loaded = st.loaded + st.edited.filterKeys { it in savedDates }) }
                }
                events.notifyDataChanged()
                events.toast(R.string.toast_schedule_saved)
                updateFor(master) { it.copy(saving = false, conflicts = emptyList(), closed = true) }
            } catch (e: Exception) {
                android.util.Log.e("Schedule", "save failed", e)
                updateFor(master) { it.copy(saving = false, error = ScheduleLogic.mapError(e.toApiFailure().httpCode)) }
            }
        }
    }

    fun confirmConflicts() = save(confirmed = true)

    fun dismissConflicts() = _state.update { it.copy(conflicts = emptyList()) }

    private fun moveWeek(weeks: Long) {
        _state.update { it.copy(weekStart = it.weekStart.plusWeeks(weeks)) }
        loadWeek()
    }

    // Догружает месяцы новой недели; уже загруженные (и правки в них) не трогает.
    // Прошлая загрузка отменяется: её месяцы, если понадобятся, запросятся заново.
    private fun loadWeek() {
        loadJob?.cancel()
        val s = _state.value
        val master = s.master ?: return
        val missing = ScheduleLogic.monthsOf(s.week).filter { it !in s.loadedMonths }
        if (missing.isEmpty()) {
            _state.update { it.copy(loading = false, loadError = false) }
            return
        }
        _state.update { it.copy(loading = true, loadError = false) }
        loadJob = viewModelScope.launch {
            try {
                val records = repository.monthsFor(master.id, missing)
                val dates = missing.flatMap { month -> (1..month.lengthOfMonth()).map { month.atDay(it) } }
                val days = ScheduleLogic.fromServer(dates, records)
                updateFor(master) {
                    it.copy(
                        loading = false,
                        loadedMonths = it.loadedMonths + missing,
                        loaded = it.loaded + days,
                        edited = days + it.edited,
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                android.util.Log.e("Schedule", "load failed", e)
                updateFor(master) { it.copy(loading = false, loadError = true) }
            }
        }
    }

    // Ответ применяется, только если шторка всё ещё открыта на том же мастере: ответ для мастера A,
    // пришедший после открытия мастера B, отбрасывается
    private fun updateFor(master: Master, transform: (ScheduleUiState) -> ScheduleUiState) =
        _state.update { if (it.master?.id == master.id) transform(it) else it }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { ScheduleViewModel(container.scheduleRepository, { container.catalogRepository.get() }, container.events) }
        }
    }
}
