package com.beauty4you.admin.ui.more

import android.net.Uri
import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.R
import com.beauty4you.admin.data.DecodedImages
import com.beauty4you.admin.data.ImageEncoder
import com.beauty4you.admin.data.remote.toApiFailure
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.CatalogEditLogic
import com.beauty4you.admin.domain.CatalogError
import com.beauty4you.admin.domain.Category
import com.beauty4you.admin.domain.CategoryDeleteBlock
import com.beauty4you.admin.domain.CategoryFieldError
import com.beauty4you.admin.domain.Master
import com.beauty4you.admin.domain.MasterFieldError
import com.beauty4you.admin.domain.MasterForm
import com.beauty4you.admin.domain.MasterPhotoState
import com.beauty4you.admin.domain.Service
import com.beauty4you.admin.domain.ServicePhotoDraft
import com.beauty4you.admin.domain.ServicePhotosLogic
import com.beauty4you.admin.domain.ServicePhotosPlan
import com.beauty4you.admin.domain.ServiceFieldError
import com.beauty4you.admin.domain.ServiceForm
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MasterEditorState(
    // null — новый мастер. После первого успешного шага сохранения сюда попадает созданный
    // мастер: повторное «Zapisz» после ошибки не создаст дубликат
    val original: Master? = null,
    val form: MasterForm = MasterForm(),
    val showFieldErrors: Boolean = false,
    val encodingPhoto: Boolean = false,
    val saving: Boolean = false,
    val error: CatalogError? = null,
) {
    val isEdit: Boolean get() = original != null
    val isDirty: Boolean get() = CatalogEditLogic.isDirty(original, form)
    val fieldErrors: Set<MasterFieldError> get() = CatalogEditLogic.validate(form)
    val visibleFieldErrors: Set<MasterFieldError> get() = if (showFieldErrors) fieldErrors else emptySet()
    val busy: Boolean get() = saving || encodingPhoto
}

data class ServiceEditorState(
    val original: Service? = null,
    val form: ServiceForm = ServiceForm(),
    // Форма в момент открытия — у новой услуги может быть предвыбрана категория
    val initial: ServiceForm = form,
    // Фото (item84): initialPhotos — что на сервере, photos — черновик; уходят на сервер по «Zapisz»
    val initialPhotos: List<ServicePhotoDraft> = emptyList(),
    val photos: List<ServicePhotoDraft> = emptyList(),
    // Фото существующей услуги ещё грузятся / не загрузились — править их нельзя, чтобы не затереть
    val photosLoading: Boolean = false,
    val photosLoadFailed: Boolean = false,
    val encodingPhoto: Boolean = false,
    val showFieldErrors: Boolean = false,
    val saving: Boolean = false,
    val error: CatalogError? = null,
    val confirmDelete: Boolean = false,
) {
    val isEdit: Boolean get() = original != null
    val isDirty: Boolean
        get() = CatalogEditLogic.isDirty(initial, form) || ServicePhotosLogic.isDirty(initialPhotos, photos)
    val photosEditable: Boolean get() = !photosLoading && !photosLoadFailed && !saving
    val canAddPhoto: Boolean get() = photosEditable && !encodingPhoto && ServicePhotosLogic.canAdd(photos.size)
}

data class CategoryEditorState(
    val original: Category? = null,
    val name: String = "",
    val showFieldErrors: Boolean = false,
    val saving: Boolean = false,
    val error: CatalogError? = null,
    val confirmDelete: Boolean = false,
    // Почему «Usuń» недоступно (категория по умолчанию или в ней есть услуги)
    val deleteBlock: CategoryDeleteBlock? = null,
) {
    val isEdit: Boolean get() = original != null
    val isDirty: Boolean get() = CatalogEditLogic.isCategoryDirty(original, name)
}

data class CatalogEditUiState(
    // Справочник на момент открытия формы — для списков выбора и проверок
    val catalog: Catalog? = null,
    val master: MasterEditorState? = null,
    val service: ServiceEditorState? = null,
    val category: CategoryEditorState? = null,
    // Шторки «Grafik pracy» / «Blokady» поверх карточки мастера (item76, часть 2)
    val scheduleMaster: Master? = null,
    val blocksMaster: Master? = null,
) {
    val serviceFieldErrors: Set<ServiceFieldError>
        get() = service?.let { s ->
            CatalogEditLogic.validate(s.form, catalog?.categories.orEmpty().map { it.id }.toSet())
        }.orEmpty()

    val categoryFieldErrors: Set<CategoryFieldError>
        get() = category?.let { c ->
            CatalogEditLogic.validateCategory(c.name, catalog?.categories.orEmpty(), c.original?.id)
        }.orEmpty()
}

// Редактирование мастеров, услуг и категорий (item76, часть 1). Все изменения — сразу на сервер;
// после успеха — событие dataChanged: списки и остальные экраны перечитывают справочники.
class CatalogEditViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(CatalogEditUiState())
    val state: StateFlow<CatalogEditUiState> = _state.asStateFlow()

    private val repository get() = container.catalogRepository

    // --- Мастер ---

    fun openNewMaster(catalog: Catalog) = _state.update { CatalogEditUiState(catalog = catalog, master = MasterEditorState()) }

    fun openMaster(catalog: Catalog, master: Master) = _state.update {
        CatalogEditUiState(catalog = catalog, master = MasterEditorState(original = master, form = CatalogEditLogic.fromMaster(master)))
    }

    fun closeMaster() {
        (master()?.form?.photo as? MasterPhotoState.Picked)?.let { DecodedImages.evict(it.dataUrl) }
        _state.update { it.copy(master = null) }
    }

    fun openSchedule(master: Master) = _state.update { it.copy(scheduleMaster = master) }

    fun closeSchedule() = _state.update { it.copy(scheduleMaster = null) }

    fun openBlocks(master: Master) = _state.update { it.copy(blocksMaster = master) }

    fun closeBlocks() = _state.update { it.copy(blocksMaster = null) }

    fun setMasterName(name: String) = updateMasterForm { it.copy(name = name) }

    fun toggleSpecialization(categoryId: String) =
        updateMasterForm { it.copy(categoryIds = CatalogEditLogic.toggle(it.categoryIds, categoryId)) }

    fun toggleMasterService(serviceId: String) =
        updateMasterForm { it.copy(serviceIds = CatalogEditLogic.toggle(it.serviceIds, serviceId)) }

    fun toggleMasterActive() = updateMasterForm { it.copy(isActive = !it.isActive) }

    fun removeMasterPhoto() = updateMasterForm {
        (it.photo as? MasterPhotoState.Picked)?.let { picked -> DecodedImages.evict(picked.dataUrl) }
        // Только что выбранное, но не сохранённое фото просто отбрасываем
        val saved = master()?.original?.photo
        it.copy(photo = if (saved != null) MasterPhotoState.Removed else MasterPhotoState.Saved(null))
    }

    fun onMasterPhotoPicked(uri: Uri) {
        updateMaster { it.copy(encodingPhoto = true, error = null) }
        viewModelScope.launch {
            val dataUrl = container.imageEncoder.encode(uri, ImageEncoder.MASTER_PHOTO_SIDE, CatalogEditLogic.PHOTO_MAX_BYTES)
            updateMaster {
                if (dataUrl == null || CatalogEditLogic.photoTooLarge(dataUrl)) {
                    it.copy(encodingPhoto = false, error = CatalogError.PHOTO_INVALID)
                } else {
                    (it.form.photo as? MasterPhotoState.Picked)?.let { old -> DecodedImages.evict(old.dataUrl) }
                    it.copy(encodingPhoto = false, form = it.form.copy(photo = MasterPhotoState.Picked(dataUrl)))
                }
            }
        }
    }

    fun saveMaster() {
        val editor = master() ?: return
        if (editor.busy) return
        if (editor.fieldErrors.isNotEmpty()) {
            updateMaster { it.copy(showFieldErrors = true) }
            return
        }
        val categoryOrder = _state.value.catalog?.categories.orEmpty().map { it.id }
        val plan = CatalogEditLogic.planSave(editor.original, editor.form, categoryOrder)
        if (plan.isNoop) {
            closeMaster()
            return
        }
        updateMaster { it.copy(saving = true, error = null, showFieldErrors = true) }
        viewModelScope.launch {
            try {
                var saved = editor.original
                plan.create?.let { saved = repository.createMaster(it).also(::rememberMaster) }
                plan.patch?.let { saved = repository.updateMaster(saved!!.id, it).also(::rememberMaster) }
                plan.uploadPhoto?.let { saved = repository.uploadMasterPhoto(saved!!.id, it).also(::rememberMaster) }
                if (plan.removePhoto) {
                    repository.removeMasterPhoto(saved!!.id)
                    saved = saved!!.copy(photo = null).also(::rememberMaster)
                }
                plan.assign.forEach { serviceId ->
                    repository.assignService(saved!!.id, serviceId)
                    saved = saved!!.copy(serviceIds = saved!!.serviceIds + serviceId).also(::rememberMaster)
                }
                plan.unassign.forEach { serviceId ->
                    try {
                        repository.unassignService(saved!!.id, serviceId)
                    } catch (e: Exception) {
                        // 404 «Service is not assigned» — уже отвязана (например, из веб-CRM)
                        if (e.toApiFailure().httpCode != 404) throw e
                    }
                    saved = saved!!.copy(serviceIds = saved!!.serviceIds - serviceId).also(::rememberMaster)
                }
                closeMaster()
                done(if (editor.original == null) R.string.toast_master_created else R.string.toast_master_saved)
            } catch (e: Exception) {
                updateMaster { it.copy(saving = false, error = mapError(e)) }
            }
        }
    }

    // Шаг сохранения прошёл: дальше форма работает с серверной версией мастера
    private fun rememberMaster(saved: Master) = updateMaster { e ->
        val photo = if (e.form.photo is MasterPhotoState.Picked && saved.photo == null) e.form.photo else MasterPhotoState.Saved(saved.photo)
        e.copy(original = saved, form = e.form.copy(photo = photo))
    }

    // --- Услуга ---

    fun openNewService(catalog: Catalog, categoryId: String? = null) = _state.update {
        // Категория по умолчанию — та, из-под заголовка которой нажали «+», иначе единственная
        val preselected = categoryId ?: catalog.categories.singleOrNull()?.id
        CatalogEditUiState(catalog = catalog, service = ServiceEditorState(form = ServiceForm(categoryId = preselected)))
    }

    fun openService(catalog: Catalog, service: Service) {
        _state.update {
            CatalogEditUiState(
                catalog = catalog,
                service = ServiceEditorState(original = service, form = CatalogEditLogic.fromService(service), photosLoading = true),
            )
        }
        loadServicePhotos(service.id)
    }

    fun closeService() {
        _state.value.service?.photos?.forEach { DecodedImages.evict(it.dataUrl) }
        _state.update { it.copy(service = null) }
    }

    // Фото существующей услуги: GET /services/:id/photos (в ответе base64, до 5 × 1 МБ)
    private fun loadServicePhotos(serviceId: String) {
        viewModelScope.launch {
            try {
                val photos = repository.listServicePhotos(serviceId)
                updateService { it.copy(initialPhotos = photos, photos = photos, photosLoading = false, photosLoadFailed = false) }
            } catch (e: Exception) {
                updateService { it.copy(photosLoading = false, photosLoadFailed = true, error = mapPhotoError(e)) }
            }
        }
    }

    fun removeServicePhoto(key: String) = updateService { editor ->
        editor.photos.firstOrNull { it.key == key && it.isNew }?.let { DecodedImages.evict(it.dataUrl) }
        editor.copy(photos = ServicePhotosLogic.remove(editor.photos, key), error = null)
    }

    fun moveServicePhoto(key: String, delta: Int) =
        updateService { it.copy(photos = ServicePhotosLogic.move(it.photos, key, delta), error = null) }

    fun onServicePhotoPicked(uri: Uri) {
        val editor = _state.value.service ?: return
        if (!editor.canAddPhoto) return
        updateService { it.copy(encodingPhoto = true, error = null) }
        viewModelScope.launch {
            val dataUrl = container.imageEncoder.encode(uri, ImageEncoder.MAX_SIDE, ServicePhotosLogic.MAX_BYTES)
            updateService {
                if (dataUrl == null || ServicePhotosLogic.tooLarge(dataUrl) || !ServicePhotosLogic.canAdd(it.photos.size)) {
                    it.copy(encodingPhoto = false, error = CatalogError.SERVICE_PHOTO_INVALID)
                } else {
                    val draft = ServicePhotoDraft(key = "new-${nextPhotoKey++}", serverId = null, dataUrl = dataUrl)
                    it.copy(encodingPhoto = false, photos = it.photos + draft)
                }
            }
        }
    }

    private var nextPhotoKey = 1

    fun setServiceCategory(categoryId: String) = updateServiceForm { it.copy(categoryId = categoryId) }

    fun setServiceName(name: String) = updateServiceForm { it.copy(name = name) }

    fun setServiceDuration(text: String) = updateServiceForm { it.copy(duration = text.filter(Char::isDigit).take(4)) }

    fun setServicePrice(text: String) = updateServiceForm { it.copy(price = text.take(12)) }

    fun saveService() {
        val editor = _state.value.service ?: return
        if (editor.saving || editor.encodingPhoto || editor.photosLoading) return
        if (_state.value.serviceFieldErrors.isNotEmpty()) {
            updateService { it.copy(showFieldErrors = true) }
            return
        }
        val fields = CatalogEditLogic.serviceFields(editor.original, editor.form)
        // Если фото не загрузились, плана по ним нет — иначе пустой черновик стёр бы все фото
        val photosPlan = if (editor.photosLoadFailed) ServicePhotosPlan() else ServicePhotosLogic.planSave(editor.initialPhotos, editor.photos)
        if (fields == null && photosPlan.isNoop) {
            closeService()
            return
        }
        updateService { it.copy(saving = true, error = null, showFieldErrors = true) }
        viewModelScope.launch {
            var saved = editor.original
            try {
                val original = editor.original
                if (original == null) {
                    // Создаём услугу первой и запоминаем её: при ошибке на фото повторное «Zapisz» не создаст дубликат
                    saved = repository.createService(fields!!)
                    updateService { it.copy(original = saved, initial = it.form) }
                } else if (fields != null) {
                    repository.updateService(original.id, fields)
                }
            } catch (e: Exception) {
                updateService { it.copy(saving = false, error = mapError(e)) }
                return@launch
            }
            val serviceId = saved?.id
            if (serviceId != null && !photosPlan.isNoop) {
                try {
                    applyPhotosPlan(serviceId, editor.photos, photosPlan)
                } catch (e: Exception) {
                    // Часть шагов могла пройти — показываем фактическое состояние сервера, черновик фото сбрасываем
                    val error = mapPhotoError(e)
                    editor.photos.forEach { if (it.isNew) DecodedImages.evict(it.dataUrl) }
                    val synced = runCatching { repository.listServicePhotos(serviceId) }.getOrNull()
                    updateService {
                        it.copy(
                            saving = false,
                            error = error,
                            initialPhotos = synced ?: it.initialPhotos,
                            photos = synced ?: it.initialPhotos,
                            photosLoadFailed = synced == null,
                        )
                    }
                    container.events.notifyDataChanged()
                    return@launch
                }
            }
            closeService()
            done(if (editor.original == null) R.string.toast_service_created else R.string.toast_service_saved)
        }
    }

    private suspend fun applyPhotosPlan(serviceId: String, photos: List<ServicePhotoDraft>, plan: ServicePhotosPlan) {
        plan.deleteIds.forEach { id ->
            try {
                repository.deleteServicePhoto(serviceId, id)
            } catch (e: Exception) {
                // 404 — уже удалено (например, из веб-CRM)
                if (e.toApiFailure().httpCode != 404) throw e
            }
        }
        val uploaded = mutableMapOf<String, String>()
        plan.uploads.forEach { draft -> uploaded[draft.key] = repository.addServicePhoto(serviceId, draft.dataUrl) }
        if (plan.reorder) repository.reorderServicePhotos(serviceId, ServicePhotosLogic.orderIds(photos, uploaded))
    }

    private fun mapPhotoError(e: Exception): CatalogError {
        android.util.Log.e("CatalogEdit", "service photos request failed", e)
        return ServicePhotosLogic.mapError(e.toApiFailure().httpCode)
    }

    fun askDeleteService() = updateService { it.copy(confirmDelete = true, error = null) }

    fun dismissDeleteService() = updateService { it.copy(confirmDelete = false) }

    fun confirmDeleteService() {
        val service = _state.value.service?.original ?: return
        updateService { it.copy(confirmDelete = false, saving = true, error = null) }
        viewModelScope.launch {
            val error = runDelete { repository.deleteService(service.id) }
            if (error == null) {
                closeService()
                done(R.string.toast_service_deleted)
            } else {
                updateService { it.copy(saving = false, error = error) }
            }
        }
    }

    // --- Категория ---

    fun openNewCategory(catalog: Catalog) = _state.update { CatalogEditUiState(catalog = catalog, category = CategoryEditorState()) }

    fun openCategory(catalog: Catalog, category: Category) = _state.update {
        CatalogEditUiState(
            catalog = catalog,
            category = CategoryEditorState(
                original = category,
                name = category.name,
                deleteBlock = CatalogEditLogic.categoryDeleteBlock(category, catalog.services),
            ),
        )
    }

    fun closeCategory() = _state.update { it.copy(category = null) }

    fun setCategoryName(name: String) = updateCategory { it.copy(name = name, error = null) }

    fun saveCategory() {
        val editor = _state.value.category ?: return
        if (editor.saving) return
        if (_state.value.categoryFieldErrors.isNotEmpty()) {
            updateCategory { it.copy(showFieldErrors = true) }
            return
        }
        val name = editor.name.trim()
        val original = editor.original
        if (original != null && original.name == name) {
            closeCategory()
            return
        }
        updateCategory { it.copy(saving = true, error = null, showFieldErrors = true) }
        viewModelScope.launch {
            try {
                if (original == null) repository.createCategory(name) else repository.renameCategory(original.id, name)
                closeCategory()
                done(if (original == null) R.string.toast_category_created else R.string.toast_category_saved)
            } catch (e: Exception) {
                updateCategory { it.copy(saving = false, error = mapError(e)) }
            }
        }
    }

    fun askDeleteCategory() = updateCategory { if (it.deleteBlock == null) it.copy(confirmDelete = true, error = null) else it }

    fun dismissDeleteCategory() = updateCategory { it.copy(confirmDelete = false) }

    fun confirmDeleteCategory() {
        val category = _state.value.category?.original ?: return
        updateCategory { it.copy(confirmDelete = false, saving = true, error = null) }
        viewModelScope.launch {
            val error = runDelete { repository.deleteCategory(category.id) }
            if (error == null) {
                closeCategory()
                done(R.string.toast_category_deleted)
            } else {
                updateCategory { it.copy(saving = false, error = error) }
            }
        }
    }

    // --- Общее ---

    // null — удалено. NOT_FOUND тоже успех: уже удалено (например, из веб-CRM)
    private suspend fun runDelete(block: suspend () -> Unit): CatalogError? =
        try {
            block()
            null
        } catch (e: Exception) {
            mapError(e).takeUnless { it == CatalogError.NOT_FOUND }
        }

    private fun mapError(e: Exception): CatalogError {
        android.util.Log.e("CatalogEdit", "request failed", e)
        val failure = e.toApiFailure()
        return CatalogEditLogic.mapError(failure.httpCode, failure.message)
    }

    private fun done(@StringRes toast: Int) {
        container.events.notifyDataChanged()
        container.events.toast(toast)
    }

    private fun master(): MasterEditorState? = _state.value.master

    private fun updateMaster(transform: (MasterEditorState) -> MasterEditorState) =
        _state.update { s -> s.copy(master = s.master?.let(transform)) }

    private fun updateMasterForm(transform: (MasterForm) -> MasterForm) =
        updateMaster { it.copy(form = transform(it.form), error = null) }

    private fun updateService(transform: (ServiceEditorState) -> ServiceEditorState) =
        _state.update { s -> s.copy(service = s.service?.let(transform)) }

    private fun updateServiceForm(transform: (ServiceForm) -> ServiceForm) =
        updateService { it.copy(form = transform(it.form), error = null) }

    private fun updateCategory(transform: (CategoryEditorState) -> CategoryEditorState) =
        _state.update { s -> s.copy(category = s.category?.let(transform)) }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { CatalogEditViewModel(container) }
        }
    }
}
