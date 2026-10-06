package com.beauty4you.admin.ui.more

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.AppEvents
import com.beauty4you.admin.R
import com.beauty4you.admin.data.remote.toApiFailure
import com.beauty4you.admin.data.repo.MasterBlocksSource
import com.beauty4you.admin.domain.BlockError
import com.beauty4you.admin.domain.BlockFieldError
import com.beauty4you.admin.domain.BlockForm
import com.beauty4you.admin.domain.BlockLogic
import com.beauty4you.admin.domain.BlockReason
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.MasterBlock
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime

data class BlockEditorState(
    val initial: BlockForm,
    val form: BlockForm = initial,
    val showFieldErrors: Boolean = false,
    val saving: Boolean = false,
    val error: BlockError? = null,
) {
    val isDirty: Boolean get() = BlockLogic.isDirty(initial, form)
    val fieldErrors: Set<BlockFieldError> get() = BlockLogic.validate(form, LocalDate.now())
    val visibleFieldErrors: Set<BlockFieldError> get() = if (showFieldErrors) fieldErrors else emptySet()
}

data class BlocksUiState(
    val master: Master? = null,
    val loading: Boolean = true,
    val loadError: Boolean = false,
    val blocks: List<MasterBlock> = emptyList(),
    val editor: BlockEditorState? = null,
    val confirmDelete: MasterBlock? = null,
    val deleting: Boolean = false,
    // Ошибка удаления — показывается в шторке списка, шторка не закрывается
    val error: BlockError? = null,
) {
    fun ownsBlock(block: MasterBlock): Boolean =
        master != null && block.masterId == master.id && blocks.any { it.id == block.id }
}

// «Blokady» мастера (item76, часть 2): будущие блокировки, «+» и удаление. GET/POST/DELETE /master-blocks.
class BlocksViewModel(
    private val repository: MasterBlocksSource,
    private val events: AppEvents,
) : ViewModel() {

    private val _state = MutableStateFlow(BlocksUiState())
    val state: StateFlow<BlocksUiState> = _state.asStateFlow()

    private var loadJob: Job? = null

    // Тот же мастер — шторка пересоздана вместе с Activity (поворот, смена темы): список и форма остаются
    fun start(master: Master) {
        if (_state.value.master?.id == master.id) return
        loadJob?.cancel()
        _state.value = BlocksUiState(master = master)
        load()
    }

    // Шторка закрыта: загрузка отменяется, следующее открытие (даже того же мастера) начнёт с чистого листа
    fun reset() {
        loadJob?.cancel()
        _state.value = BlocksUiState()
    }

    fun load() {
        val master = _state.value.master ?: return
        loadJob?.cancel()
        _state.update { it.copy(loading = it.blocks.isEmpty(), loadError = false) }
        loadJob = viewModelScope.launch {
            try {
                val today = LocalDate.now()
                val blocks = BlockLogic.upcoming(repository.blocksOf(master.id, today), master.id, today)
                updateFor(master) { it.copy(loading = false, blocks = blocks) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                android.util.Log.e("Blocks", "load failed", e)
                updateFor(master) { it.copy(loading = false, loadError = it.blocks.isEmpty()) }
            }
        }
    }

    // --- Новая блокировка ---

    fun openNew() = _state.update { it.copy(editor = BlockEditorState(BlockLogic.newForm(LocalDate.now())), error = null) }

    fun closeEditor() = _state.update { it.copy(editor = null) }

    fun setDate(date: LocalDate) = updateForm { it.copy(date = date) }

    fun setStart(time: LocalTime) = updateForm { it.copy(start = time) }

    fun setEnd(time: LocalTime) = updateForm { it.copy(end = time) }

    fun setReason(reason: BlockReason) = updateForm { it.copy(reason = reason) }

    fun setComment(comment: String) = updateForm { it.copy(comment = comment.take(BlockLogic.REASON_MAX)) }

    fun save() {
        val master = _state.value.master ?: return
        val editor = _state.value.editor ?: return
        if (editor.saving) return
        if (editor.fieldErrors.isNotEmpty()) {
            updateEditor { it.copy(showFieldErrors = true) }
            return
        }
        val form = editor.form
        updateEditor { it.copy(saving = true, error = null, showFieldErrors = true) }
        viewModelScope.launch {
            try {
                val block = repository.createBlock(
                    masterId = master.id,
                    startTime = BlockLogic.toApiDateTime(form.date, form.start),
                    endTime = BlockLogic.toApiDateTime(form.date, form.end),
                    reason = BlockLogic.reasonText(form),
                )
                updateFor(master) { s -> s.copy(editor = null, blocks = (s.blocks + block).sortedBy { it.start }) }
                done(R.string.toast_block_created)
            } catch (e: Exception) {
                android.util.Log.e("Blocks", "create failed", e)
                val failure = e.toApiFailure()
                updateFor(master) { s ->
                    s.copy(editor = s.editor?.copy(saving = false, error = BlockLogic.mapError(failure.httpCode, failure.message)))
                }
            }
        }
    }

    // --- Удаление ---

    // Удалить можно только блокировку из списка открытого мастера
    fun askDelete(block: MasterBlock) {
        if (!_state.value.ownsBlock(block)) return
        _state.update { it.copy(confirmDelete = block, error = null) }
    }

    fun dismissDelete() = _state.update { it.copy(confirmDelete = null) }

    fun confirmDelete() {
        val s = _state.value
        val master = s.master ?: return
        val block = s.confirmDelete ?: return
        if (!s.ownsBlock(block)) {
            _state.update { it.copy(confirmDelete = null) }
            return
        }
        _state.update { it.copy(confirmDelete = null, deleting = true, error = null) }
        viewModelScope.launch {
            val error = try {
                repository.deleteBlock(block.id)
                null
            } catch (e: Exception) {
                val failure = e.toApiFailure()
                // 404 — уже удалена (например, в веб-CRM): результат тот же
                BlockLogic.mapError(failure.httpCode, failure.message).takeUnless { it == BlockError.NOT_FOUND }
            }
            if (error == null) {
                updateFor(master) { st -> st.copy(deleting = false, blocks = st.blocks.filterNot { it.id == block.id }) }
                done(R.string.toast_block_deleted)
            } else {
                updateFor(master) { it.copy(deleting = false, error = error) }
            }
        }
    }

    private fun done(toast: Int) {
        // Календарь и Timeline перечитают блокировки
        events.notifyDataChanged()
        events.toast(toast)
    }

    // Ответ применяется, только если шторка всё ещё открыта на том же мастере: ответ для мастера A,
    // пришедший после открытия мастера B, отбрасывается
    private fun updateFor(master: Master, transform: (BlocksUiState) -> BlocksUiState) =
        _state.update { if (it.master?.id == master.id) transform(it) else it }

    private fun updateEditor(transform: (BlockEditorState) -> BlockEditorState) =
        _state.update { s -> s.copy(editor = s.editor?.let(transform)) }

    private fun updateForm(transform: (BlockForm) -> BlockForm) =
        updateEditor { it.copy(form = transform(it.form), error = null) }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { BlocksViewModel(container.scheduleRepository, container.events) }
        }
    }
}
