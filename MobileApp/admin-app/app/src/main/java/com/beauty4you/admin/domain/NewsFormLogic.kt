package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.ZoneId

// Картинка в форме: та, что уже на сервере (или её нет), новая выбранная, либо удалённая
sealed interface NewsImage {
    data class Saved(val dataUrl: String?) : NewsImage
    data class Picked(val dataUrl: String) : NewsImage
    data object Removed : NewsImage

    val preview: String?
        get() = when (this) {
            is Saved -> dataUrl
            is Picked -> dataUrl
            Removed -> null
        }
}

data class NewsForm(
    val category: NewsCategory = NewsCategory.NOWOSC,
    val title: String = "",
    val body: String = "",
    val status: NewsStatus = NewsStatus.DRAFT,
    val image: NewsImage = NewsImage.Saved(null),
)

enum class NewsFieldError { TITLE_EMPTY, TITLE_TOO_LONG, BODY_EMPTY, BODY_TOO_LONG }

// Поля для POST /news и PATCH /news/:id; null в PATCH — «не менять»
data class NewsFields(
    val category: NewsCategory? = null,
    val title: String? = null,
    val body: String? = null,
    val status: NewsStatus? = null,
) {
    val isEmpty: Boolean get() = category == null && title == null && body == null && status == null
}

// Шаги сохранения выполняются по порядку: create → картинка (upload/remove) → patch.
// Публикация всегда идёт ПОСЛЕДНИМ шагом: если загрузка картинки упадёт, клиенты не увидят
// новость без неё (и не увидят старую картинку у уже исправленного текста).
data class NewsSavePlan(
    val create: NewsFields? = null,
    val uploadImage: String? = null,
    val removeImage: Boolean = false,
    val patch: NewsFields? = null,
) {
    val isNoop: Boolean get() = create == null && uploadImage == null && !removeImage && patch == null
}

enum class NewsSaveToast { PUBLISHED, DRAFT }

// Ошибка сохранения/удаления — показывается в форме, форма остаётся открытой
enum class NewsError { IMAGE_INVALID, VALIDATION, NOT_FOUND, NETWORK, UNKNOWN }

// Логика формы «Nowy wpis / Edytuj wpis» — чистый Kotlin, проверяется JVM unit-тестами.
// Лимиты — те же, что проверяет бэкенд (CreateNewsDto, NewsService).
object NewsFormLogic {
    const val TITLE_MAX = 120
    const val BODY_MAX = 2000
    const val IMAGE_MAX_BYTES = 5 * 1024 * 1024

    fun fromPost(post: NewsPost) = NewsForm(
        category = post.category,
        title = post.title,
        body = post.body,
        status = post.status,
        image = NewsImage.Saved(post.imageUrl),
    )

    // Пробелы по краям бэкенд обрезает — проверяем так же, чтобы «   » не прошло как заголовок
    fun validate(form: NewsForm): Set<NewsFieldError> = buildSet {
        val title = form.title.trim()
        val body = form.body.trim()
        if (title.isEmpty()) add(NewsFieldError.TITLE_EMPTY)
        if (title.length > TITLE_MAX) add(NewsFieldError.TITLE_TOO_LONG)
        if (body.isEmpty()) add(NewsFieldError.BODY_EMPTY)
        if (body.length > BODY_MAX) add(NewsFieldError.BODY_TOO_LONG)
    }

    fun nextCategory(category: NewsCategory): NewsCategory =
        NewsCategory.entries[(category.ordinal + 1) % NewsCategory.entries.size]

    fun toggleStatus(status: NewsStatus): NewsStatus =
        if (status == NewsStatus.PUBLISHED) NewsStatus.DRAFT else NewsStatus.PUBLISHED

    fun planSave(original: NewsPost?, form: NewsForm): NewsSavePlan {
        val title = form.title.trim()
        val body = form.body.trim()
        val upload = (form.image as? NewsImage.Picked)?.dataUrl

        if (original == null) {
            // Новая публикуемая новость с картинкой: создаём черновиком, публикуем после загрузки
            val deferPublish = upload != null && form.status == NewsStatus.PUBLISHED
            return NewsSavePlan(
                create = NewsFields(form.category, title, body, if (deferPublish) NewsStatus.DRAFT else form.status),
                uploadImage = upload,
                patch = if (deferPublish) NewsFields(status = NewsStatus.PUBLISHED) else null,
            )
        }

        val patch = NewsFields(
            category = form.category.takeIf { it != original.category },
            title = title.takeIf { it != original.title },
            body = body.takeIf { it != original.body },
            status = form.status.takeIf { it != original.status },
        )
        return NewsSavePlan(
            uploadImage = upload,
            removeImage = form.image == NewsImage.Removed && original.imageUrl != null,
            patch = patch.takeUnless { it.isEmpty },
        )
    }

    // httpCode == null — сервер недоступен. Текст 400 от Nest отличает картинку от полей формы.
    fun mapError(httpCode: Int?, message: String?): NewsError = when {
        httpCode == null -> NewsError.NETWORK
        httpCode == 400 && message.orEmpty().contains("image", ignoreCase = true) -> NewsError.IMAGE_INVALID
        httpCode == 400 -> NewsError.VALIDATION
        httpCode == 404 -> NewsError.NOT_FOUND
        else -> NewsError.UNKNOWN
    }

    fun toast(status: NewsStatus): NewsSaveToast =
        if (status == NewsStatus.PUBLISHED) NewsSaveToast.PUBLISHED else NewsSaveToast.DRAFT

    // Дата на карточке: у опубликованной — дата первой публикации, у черновика — создания
    fun displayDate(post: NewsPost, zone: ZoneId): LocalDate =
        (post.publishedAt ?: post.createdAt).atZone(zone).toLocalDate()

    // Размер картинки после декодирования base64 — тот же предел, что на сервере
    fun imageBytes(dataUrl: String): Int {
        val payload = dataUrl.substringAfter(",")
        val padding = payload.takeLast(2).count { it == '=' }
        return payload.length / 4 * 3 - padding
    }

    fun imageTooLarge(dataUrl: String): Boolean = imageBytes(dataUrl) > IMAGE_MAX_BYTES

    // Список: новые сверху (бэкенд отдаёт так же; сортируем на случай локальных правок)
    fun sorted(posts: List<NewsPost>): List<NewsPost> = posts.sortedByDescending(NewsPost::createdAt)

    fun replace(posts: List<NewsPost>, post: NewsPost): List<NewsPost> =
        sorted(posts.filterNot { it.id == post.id } + post)
}
