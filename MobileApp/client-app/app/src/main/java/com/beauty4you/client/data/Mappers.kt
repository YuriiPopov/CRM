package com.beauty4you.client.data

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import com.beauty4you.client.data.remote.BookingDto
import com.beauty4you.client.data.remote.CatalogDto
import com.beauty4you.client.data.remote.ClientDto
import com.beauty4you.client.data.remote.NewsDto
import com.beauty4you.client.data.remote.SlotDto
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

// ВАЖНО: бэкенд хранит время записи как "время салона, записанное с меткой UTC" (MVP без
// per-salon таймзоны, см. master-app Appointment.kt и frontend dateUtils.ts). Поэтому цифры
// читаются как есть, БЕЗ перевода в часовой пояс устройства — иначе в Europe/Warsaw всё
// сдвинулось бы на +1/+2 ч относительно веб-CRM и приложения мастера.
fun parseSalonTime(iso: String): LocalDateTime = LocalDateTime.ofInstant(Instant.parse(iso), ZoneOffset.UTC)

fun ClientDto.toDomain() = Client(id = id, name = name, phone = phone, email = email)

fun BookingDto.toDomain() = Booking(
    id = id,
    serviceId = serviceId,
    serviceName = serviceName,
    masterId = masterId,
    masterName = masterName,
    start = parseSalonTime(startTime),
    price = price,
    status = when (status) {
        "CONFIRMED" -> BookingStatus.CONFIRMED
        "COMPLETED" -> BookingStatus.DONE
        "CANCELLED" -> BookingStatus.CANCELLED
        "NO_SHOW" -> BookingStatus.NO_SHOW
        else -> BookingStatus.PENDING // CREATED
    },
)

fun SlotDto.toDomain() = Slot(startIso = startTime, time = parseSalonTime(startTime).toLocalTime())

/** [decodePhoto] вынесен параметром: BitmapFactory недоступен в JVM unit-тестах. */
fun CatalogDto.toDomain(decodePhoto: (String) -> ImageBitmap?): Catalog {
    val categoryNames = categories.associate { it.id to it.name }
    return Catalog(
        salonName = salon.name,
        categories = categories.map { Category(it.id, it.name) },
        services = services.map {
            Service(
                id = it.id,
                categoryId = it.categoryId,
                name = it.name,
                durationMin = it.durationMin,
                price = it.price,
                emoji = serviceEmoji(categoryNames[it.categoryId].orEmpty(), it.name),
                photoCount = it.photoCount,
                coverPhotoId = it.coverPhotoId,
            )
        },
        masters = masters.map {
            Master(
                id = it.id,
                name = it.name,
                color = masterColor(it.id),
                photo = it.photo?.let(decodePhoto),
                specialty = it.specializations.joinToString(", "),
                serviceIds = it.serviceIds,
            )
        },
    )
}

// Категории новостей — подписи и цвета как в admin-app (NEWS_TAGS дизайна «B4U Admin App»)
private val NEWS_TAGS = mapOf(
    "NOWOSC" to NewsTag("Nowość", Color(0xFF4F8A82), "✨"),
    "DIGEST" to NewsTag("Digest", Color(0xFF6E7FC9), "📰"),
    "INSPIRACJA" to NewsTag("Inspiracja", Color(0xFFA85B93), "💡"),
)

/**
 * Лента Aktualności: новые сверху. Новость с категорией, неизвестной этой версии приложения,
 * пропускается. [decodeImage] получает id новости и её data URL — так репозиторий кэширует
 * декодированные картинки по id (BitmapFactory к тому же нет в unit-тестах).
 */
fun List<NewsDto>.toNewsFeed(decodeImage: (id: String, dataUrl: String) -> ImageBitmap?, zone: ZoneId): List<NewsItem> =
    mapNotNull { dto -> NEWS_TAGS[dto.category]?.let { tag -> Instant.parse(dto.publishedAt) to dto.toNewsItem(tag, decodeImage, zone) } }
        .sortedByDescending { it.first }
        .map { it.second }

private fun NewsDto.toNewsItem(tag: NewsTag, decodeImage: (String, String) -> ImageBitmap?, zone: ZoneId) = NewsItem(
    id = id,
    tag = tag,
    title = title,
    text = body,
    date = Instant.parse(publishedAt).atZone(zone).toLocalDate(),
    image = imageUrl?.let { decodeImage(id, it) },
)

private val EMOJI_BY_KEYWORD = listOf(
    listOf("маник", "педик", "ногт", "paznok", "manicure", "pedicure", "nail") to "💅",
    listOf("масс", "masaż", "masaz", "massage") to "💆",
    listOf("спа", "spa", "бочк") to "🧖",
    listOf("бров", "ресниц", "brwi", "rzęs", "brow", "lash") to "👁️",
    listOf("волос", "стриж", "włos", "strzyż", "hair") to "✂️",
    listOf("лиц", "twarz", "face") to "🧴",
)

/** Эмодзи-плейсхолдер услуги по ключевым словам категории/названия (русский/польский/английский). */
fun serviceEmoji(category: String, name: String): String {
    val haystack = "$category $name".lowercase()
    return EMOJI_BY_KEYWORD.firstOrNull { (keys, _) -> keys.any { it in haystack } }?.second ?: "✨"
}

// Порт 1-в-1 из frontend/src/pages/dashboard/masterColor.ts (как и в master-app) — акцентный цвет
// мастера совпадает с его цветом на таймлайне веб-дашборда администратора.
private val MASTER_COLOR_PALETTE = listOf(
    Color(0xFF2563EB), Color(0xFF16A34A), Color(0xFFD97706), Color(0xFFDB2777),
    Color(0xFF7C3AED), Color(0xFF0891B2), Color(0xFFDC2626), Color(0xFF65A30D),
)

fun masterColor(masterId: String): Color {
    var hash = 0L
    for (ch in masterId) hash = (hash * 31 + ch.code) and 0xFFFFFFFFL
    return MASTER_COLOR_PALETTE[(hash % MASTER_COLOR_PALETTE.size).toInt()]
}
