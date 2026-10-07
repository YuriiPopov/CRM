package com.beauty4you.admin.domain

import java.math.BigDecimal

// Редактирование мастеров, услуг и категорий (item76, часть 1) — чистый Kotlin, проверяется
// JVM unit-тестами. Ограничения — те же, что у DTO бэкенда (CreateMasterDto, CreateServiceDto,
// CreateServiceCategoryDto, UploadMasterPhotoDto).

// Фото в форме мастера: уже сохранённое на сервере (или его нет), новое выбранное, либо удалённое
sealed interface MasterPhotoState {
    data class Saved(val dataUrl: String?) : MasterPhotoState
    data class Picked(val dataUrl: String) : MasterPhotoState
    data object Removed : MasterPhotoState

    val preview: String?
        get() = when (this) {
            is Saved -> dataUrl
            is Picked -> dataUrl
            Removed -> null
        }
}

data class MasterForm(
    val name: String = "",
    val categoryIds: Set<String> = emptySet(),
    val serviceIds: Set<String> = emptySet(),
    val isActive: Boolean = true,
    val photo: MasterPhotoState = MasterPhotoState.Saved(null),
)

enum class MasterFieldError { NAME_EMPTY, NO_SPECIALIZATION }

// Поля для POST /staff и PATCH /staff/:id; null в PATCH — «не менять»
data class MasterFields(
    val name: String? = null,
    val categoryIds: List<String>? = null,
    val isActive: Boolean? = null,
) {
    val isEmpty: Boolean get() = name == null && categoryIds == null && isActive == null
}

// Шаги сохранения по порядку: create → patch → фото → привязка/отвязка услуг. Каждый шаг —
// отдельный запрос (атомарного эндпоинта нет), поэтому после ошибки форма остаётся открытой,
// а повторное «Zapisz» досылает только то, что ещё не совпадает с сервером.
data class MasterSavePlan(
    val create: MasterFields? = null,
    val patch: MasterFields? = null,
    val uploadPhoto: String? = null,
    val removePhoto: Boolean = false,
    val assign: List<String> = emptyList(),
    val unassign: List<String> = emptyList(),
) {
    val isNoop: Boolean
        get() = create == null && patch == null && uploadPhoto == null && !removePhoto &&
            assign.isEmpty() && unassign.isEmpty()
}

data class ServiceForm(
    val categoryId: String? = null,
    val name: String = "",
    // Текст полей как ввёл пользователь — разбирается при проверке (цена допускает «99,50»)
    val duration: String = "",
    val price: String = "",
)

enum class ServiceFieldError { CATEGORY_EMPTY, NAME_EMPTY, DURATION_INVALID, PRICE_INVALID }

// Поля для POST /services и PATCH /services/:id; null в PATCH — «не менять»
data class ServiceFields(
    val name: String? = null,
    val categoryId: String? = null,
    val durationMin: Int? = null,
    val price: BigDecimal? = null,
) {
    val isEmpty: Boolean get() = name == null && categoryId == null && durationMin == null && price == null
}

enum class CategoryFieldError { NAME_EMPTY, NAME_TAKEN }

// Почему категорию нельзя удалить из приложения. Бэкенд сам удалил бы непустую категорию,
// молча перенеся её услуги в категорию по умолчанию, — по ТЗ удаляем только пустую.
enum class CategoryDeleteBlock { DEFAULT, HAS_SERVICES }

// Ошибка сохранения/удаления — показывается в форме, форма остаётся открытой
enum class CatalogError {
    MASTER_HAS_BOOKINGS,
    SERVICE_IN_USE,
    CATEGORY_DEFAULT,
    PHOTO_INVALID,
    SERVICE_PHOTO_INVALID,
    VALIDATION,
    NOT_FOUND,
    NETWORK,
    UNKNOWN,
}

object CatalogEditLogic {
    const val PHOTO_MAX_BYTES = 2 * 1024 * 1024

    // Длительность услуги: целое число минут, разумный предел — сутки
    const val DURATION_MAX = 24 * 60

    // Decimal(10, 2) в БД: до 8 цифр до запятой
    private val PRICE_MAX = BigDecimal("99999999.99")

    // --- Мастер ---

    fun fromMaster(master: Master) = MasterForm(
        name = master.name,
        categoryIds = master.categoryIds.toSet(),
        serviceIds = master.serviceIds,
        isActive = master.isActive,
        photo = MasterPhotoState.Saved(master.photo),
    )

    fun validate(form: MasterForm): Set<MasterFieldError> = buildSet {
        if (form.name.trim().isEmpty()) add(MasterFieldError.NAME_EMPTY)
        // Бэкенд требует хотя бы одну специализацию (ArrayMinSize(1))
        if (form.categoryIds.isEmpty()) add(MasterFieldError.NO_SPECIALIZATION)
    }

    // Есть несохранённые изменения (item76, «Odrzucić zmiany?»): форма отличается от исходного
    // мастера или от пустой. Пробелы по краям имени не считаются — при сохранении их обрежем.
    fun isDirty(original: Master?, form: MasterForm): Boolean {
        val initial = original?.let(::fromMaster) ?: MasterForm()
        return form.copy(name = form.name.trim()) != initial.copy(name = initial.name.trim())
    }

    fun toggle(set: Set<String>, id: String): Set<String> = if (id in set) set - id else set + id

    // Список id в порядке справочника категорий: при PATCH сравниваем как множество
    fun planSave(original: Master?, form: MasterForm, categoryOrder: List<String>): MasterSavePlan {
        val name = form.name.trim()
        val categoryIds = categoryOrder.filter { it in form.categoryIds } +
            form.categoryIds.filter { it !in categoryOrder }.sorted()
        val upload = (form.photo as? MasterPhotoState.Picked)?.dataUrl
        val currentServices = original?.serviceIds.orEmpty()

        val create = if (original == null) {
            // isActive при создании не отправляем — новый мастер активен по умолчанию
            MasterFields(name = name, categoryIds = categoryIds)
        } else {
            null
        }
        val patch = if (original != null) {
            MasterFields(
                name = name.takeIf { it != original.name },
                categoryIds = categoryIds.takeIf { it.toSet() != original.categoryIds.toSet() },
                isActive = form.isActive.takeIf { it != original.isActive },
            ).takeUnless { it.isEmpty }
        } else {
            // Новый мастер, которого сразу сохраняют неактивным
            MasterFields(isActive = false).takeIf { !form.isActive }
        }
        return MasterSavePlan(
            create = create,
            patch = patch,
            uploadPhoto = upload,
            removePhoto = form.photo == MasterPhotoState.Removed && original?.photo != null,
            assign = (form.serviceIds - currentServices).sorted(),
            unassign = (currentServices - form.serviceIds).sorted(),
        )
    }

    // Размер фото после декодирования base64 — тот же предел (2 МБ), что проверяет сервер
    fun photoTooLarge(dataUrl: String): Boolean = NewsFormLogic.imageBytes(dataUrl) > PHOTO_MAX_BYTES

    // Активные сверху, внутри — по алфавиту (неактивные остаются видны, как в веб-CRM)
    fun sortedMasters(masters: List<Master>): List<Master> =
        masters.sortedWith(compareBy<Master> { !it.isActive }.thenBy { it.name.lowercase() })

    // --- Услуга ---

    fun fromService(service: Service) = ServiceForm(
        categoryId = service.categoryId,
        name = service.name,
        duration = service.durationMin.toString(),
        price = priceInput(service.price),
    )

    // initial — форма в момент открытия (у новой услуги может быть предвыбрана категория)
    fun isDirty(initial: ServiceForm, form: ServiceForm): Boolean = form.normalized() != initial.normalized()

    private fun ServiceForm.normalized() = copy(name = name.trim(), duration = duration.trim(), price = price.trim())

    // "150.00" -> "150", "99.50" -> "99,50" — так, как цену удобно править с клавиатуры
    fun priceInput(raw: String): String {
        val value = raw.trim().toBigDecimalOrNull() ?: return raw
        val plain = value.stripTrailingZeros().let { if (it.scale() < 0) it.setScale(0) else it }
        return if (plain.scale() == 0) plain.toPlainString() else value.setScale(2).toPlainString().replace('.', ',')
    }

    fun parseDuration(text: String): Int? =
        text.trim().toIntOrNull()?.takeIf { it in 1..DURATION_MAX }

    // Принимает «150», «99,5», «99.50», «1 200»; не больше двух знаков после запятой, не меньше 0
    fun parsePrice(text: String): BigDecimal? {
        val normalized = text.trim().replace(" ", "").replace(' '.toString(), "").replace(',', '.')
        if (!PRICE_PATTERN.matches(normalized)) return null
        val value = normalized.toBigDecimalOrNull() ?: return null
        return value.takeIf { it.signum() >= 0 && it <= PRICE_MAX }
    }

    fun validate(form: ServiceForm, categoryIds: Set<String>): Set<ServiceFieldError> = buildSet {
        if (form.categoryId == null || form.categoryId !in categoryIds) add(ServiceFieldError.CATEGORY_EMPTY)
        if (form.name.trim().isEmpty()) add(ServiceFieldError.NAME_EMPTY)
        if (parseDuration(form.duration) == null) add(ServiceFieldError.DURATION_INVALID)
        if (parsePrice(form.price) == null) add(ServiceFieldError.PRICE_INVALID)
    }

    // Вызывается только для формы без ошибок (validate пуст)
    fun serviceFields(original: Service?, form: ServiceForm): ServiceFields? {
        val name = form.name.trim()
        val duration = parseDuration(form.duration) ?: return null
        val price = parsePrice(form.price) ?: return null
        val categoryId = form.categoryId ?: return null
        if (original == null) return ServiceFields(name, categoryId, duration, price)
        val originalPrice = original.price.trim().toBigDecimalOrNull()
        return ServiceFields(
            name = name.takeIf { it != original.name },
            categoryId = categoryId.takeIf { it != original.categoryId },
            durationMin = duration.takeIf { it != original.durationMin },
            price = price.takeIf { originalPrice == null || it.compareTo(originalPrice) != 0 },
        ).takeUnless { it.isEmpty }
    }

    // Категории по алфавиту, в каждой — её услуги по алфавиту; пустые категории тоже в списке,
    // чтобы их можно было переименовать или удалить. Услуги с неизвестной категорией — в конце.
    fun groupServices(categories: List<Category>, services: List<Service>): List<Pair<Category?, List<Service>>> {
        val byCategory = services.groupBy { it.categoryId }
        val known = categories.sortedBy { it.name.lowercase() }.map { category ->
            category to byCategory[category.id].orEmpty().sortedBy { it.name.lowercase() }
        }
        val knownIds = categories.map { it.id }.toSet()
        val orphans = services.filter { it.categoryId !in knownIds }.sortedBy { it.name.lowercase() }
        return if (orphans.isEmpty()) known else known + (null to orphans)
    }

    // --- Категория ---

    fun validateCategory(name: String, categories: List<Category>, editingId: String?): Set<CategoryFieldError> = buildSet {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) add(CategoryFieldError.NAME_EMPTY)
        // Бэкенд дубликаты не запрещает, но две «Manicure» в списке только путают
        else if (categories.any { it.id != editingId && it.name.trim().equals(trimmed, ignoreCase = true) }) {
            add(CategoryFieldError.NAME_TAKEN)
        }
    }

    fun isCategoryDirty(original: Category?, name: String): Boolean = name.trim() != original?.name.orEmpty().trim()

    fun categoryDeleteBlock(category: Category, services: List<Service>): CategoryDeleteBlock? = when {
        category.isDefault -> CategoryDeleteBlock.DEFAULT
        services.any { it.categoryId == category.id } -> CategoryDeleteBlock.HAS_SERVICES
        else -> null
    }

    // --- Ошибки бэкенда ---

    // httpCode == null — сервер недоступен. Тексты 409/400 — из StaffService, ServicesService,
    // ServiceCategoriesService и UploadMasterPhotoDto.
    fun mapError(httpCode: Int?, message: String?): CatalogError {
        val text = message.orEmpty().lowercase()
        return when {
            httpCode == null -> CatalogError.NETWORK
            httpCode == 409 && "активными записями" in text -> CatalogError.MASTER_HAS_BOOKINGS
            httpCode == 409 && "referenced by" in text -> CatalogError.SERVICE_IN_USE
            httpCode == 409 && "default category" in text -> CatalogError.CATEGORY_DEFAULT
            httpCode == 400 && "photo" in text -> CatalogError.PHOTO_INVALID
            httpCode == 400 -> CatalogError.VALIDATION
            httpCode == 404 -> CatalogError.NOT_FOUND
            else -> CatalogError.UNKNOWN
        }
    }

    private val PRICE_PATTERN = Regex("""^\d+(\.\d{1,2})?$""")

    private fun String.toBigDecimalOrNull(): BigDecimal? = runCatching { BigDecimal(this) }.getOrNull()
}
