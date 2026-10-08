package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

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

// Статья в форме (item89): сохранённая на сервере (или её нет), выбранный файл либо удалённая
sealed interface NewsArticle {
    data class Saved(val exists: Boolean) : NewsArticle
    data class Picked(val fileName: String, val sizeBytes: Long, val html: String) : NewsArticle
    data object Removed : NewsArticle

    val attached: Boolean
        get() = when (this) {
            is Saved -> exists
            is Picked -> true
            Removed -> false
        }
}

data class NewsForm(
    val category: NewsCategory = NewsCategory.NOWOSC,
    val title: String = "",
    val body: String = "",
    val status: NewsStatus = NewsStatus.DRAFT,
    val image: NewsImage = NewsImage.Saved(null),
    val article: NewsArticle = NewsArticle.Saved(false),
)

enum class NewsFieldError { TITLE_EMPTY, TITLE_TOO_LONG, BODY_EMPTY, BODY_TOO_LONG }

// Поля для POST /news и PATCH /news/:id; null в PATCH — «не менять»
data class NewsFields(
    val category: NewsCategory? = null,
    val title: String? = null,
    val body: String? = null,
    val status: NewsStatus? = null,
    // HTML статьи; "" — удалить статью (так backend отличает «убрать» от «не менять»)
    val contentHtml: String? = null,
) {
    val isEmpty: Boolean
        get() = category == null && title == null && body == null && status == null && contentHtml == null
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
enum class NewsError {
    IMAGE_INVALID, VALIDATION, NOT_FOUND, NETWORK, UNKNOWN,

    // Статья (item89): ответы backend 413/422 и проверки выбранного файла на устройстве
    ARTICLE_TOO_LARGE, ARTICLE_RESULT_TOO_LARGE, ARTICLE_INVALID_HTML, ARTICLE_IMAGE_INVALID,
    ARTICLE_NOT_HTML, ARTICLE_EMPTY, ARTICLE_UNREADABLE,
}

// Логика формы «Nowy wpis / Edytuj wpis» — чистый Kotlin, проверяется JVM unit-тестами.
// Лимиты — те же, что проверяет бэкенд (CreateNewsDto, NewsService).
object NewsFormLogic {
    const val TITLE_MAX = 120
    const val BODY_MAX = 2000
    const val IMAGE_MAX_BYTES = 5 * 1024 * 1024
    // Исходный HTML-файл статьи; после обработки на сервере — не более 4 МБ
    const val ARTICLE_MAX_BYTES = 12 * 1024 * 1024

    fun fromPost(post: NewsPost) = NewsForm(
        category = post.category,
        title = post.title,
        body = post.body,
        status = post.status,
        image = NewsImage.Saved(post.imageUrl),
        article = NewsArticle.Saved(post.hasArticle),
    )

    // Есть несохранённые изменения (item76, «Odrzucić zmiany?»): форма отличается от исходной
    // новости или от пустой. Пробелы по краям не считаются — бэкенд их всё равно обрежет.
    fun isDirty(original: NewsPost?, form: NewsForm): Boolean {
        val initial = original?.let(::fromPost) ?: NewsForm()
        return form.normalized() != initial.normalized()
    }

    private fun NewsForm.normalized() = copy(title = title.trim(), body = body.trim())

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
        val articleHtml = (form.article as? NewsArticle.Picked)?.html

        if (original == null) {
            // Новая публикуемая новость с картинкой: создаём черновиком, публикуем после загрузки
            val deferPublish = upload != null && form.status == NewsStatus.PUBLISHED
            return NewsSavePlan(
                create = NewsFields(form.category, title, body, if (deferPublish) NewsStatus.DRAFT else form.status, articleHtml),
                uploadImage = upload,
                patch = if (deferPublish) NewsFields(status = NewsStatus.PUBLISHED) else null,
            )
        }

        val patch = NewsFields(
            category = form.category.takeIf { it != original.category },
            title = title.takeIf { it != original.title },
            body = body.takeIf { it != original.body },
            status = form.status.takeIf { it != original.status },
            contentHtml = when {
                articleHtml != null -> articleHtml
                form.article == NewsArticle.Removed && original.hasArticle -> ""
                else -> null
            },
        )
        return NewsSavePlan(
            uploadImage = upload,
            removeImage = form.image == NewsImage.Removed && original.imageUrl != null,
            patch = patch.takeUnless { it.isEmpty },
        )
    }

    // Проверка выбранного файла статьи до чтения/отправки; null — файл подходит
    fun validateArticleFile(fileName: String?, sizeBytes: Long?): NewsError? {
        val name = fileName.orEmpty().lowercase()
        if (!name.endsWith(".html") && !name.endsWith(".htm")) return NewsError.ARTICLE_NOT_HTML
        if (sizeBytes != null && sizeBytes <= 0L) return NewsError.ARTICLE_EMPTY
        if (sizeBytes != null && sizeBytes > ARTICLE_MAX_BYTES) return NewsError.ARTICLE_TOO_LARGE
        return null
    }

    // «1,2 MB» / «340 KB» — размер файла рядом с именем
    fun fileSizeLabel(bytes: Long): String = when {
        bytes >= 1024 * 1024 -> String.format(Locale("pl", "PL"), "%.1f MB", bytes / 1024.0 / 1024.0)
        bytes >= 1024 -> "${(bytes + 512) / 1024} KB"
        else -> "$bytes B"
    }

    // httpCode == null — сервер недоступен. Текст 400 от Nest отличает картинку от полей формы.
    // code — машинный код 422 статьи (ARTICLE_*), 413 — тело больше лимита JSON.
    fun mapError(httpCode: Int?, message: String?, code: String? = null): NewsError = when {
        httpCode == null -> NewsError.NETWORK
        httpCode == 413 -> NewsError.ARTICLE_TOO_LARGE
        httpCode == 422 -> when (code) {
            "ARTICLE_TOO_LARGE" -> NewsError.ARTICLE_TOO_LARGE
            "ARTICLE_RESULT_TOO_LARGE" -> NewsError.ARTICLE_RESULT_TOO_LARGE
            "ARTICLE_IMAGE_INVALID" -> NewsError.ARTICLE_IMAGE_INVALID
            else -> NewsError.ARTICLE_INVALID_HTML
        }
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
