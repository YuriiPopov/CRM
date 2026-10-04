package com.beauty4you.client.data

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

data class Client(val id: String, val name: String, val phone: String, val email: String?) {
    val firstName: String get() = name.trim().substringBefore(' ')
    val initials: String
        get() = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
            .take(2).joinToString("") { it.first().uppercase() }
}

data class Category(val id: String, val name: String)

data class Service(
    val id: String,
    val categoryId: String,
    val name: String,
    val durationMin: Int,
    val price: Double,
    // Плейсхолдер (подбирается по названию категории) до появления реальных иконок услуг.
    val emoji: String,
)

data class Master(
    val id: String,
    val name: String,
    val color: Color,
    val photo: ImageBitmap?,
    val specialty: String,
    val serviceIds: List<String>,
)

data class Catalog(
    val salonName: String,
    val categories: List<Category>,
    val services: List<Service>,
    val masters: List<Master>,
) {
    fun service(id: String): Service? = services.firstOrNull { it.id == id }
    fun master(id: String): Master? = masters.firstOrNull { it.id == id }
    fun mastersFor(serviceId: String): List<Master> = masters.filter { serviceId in it.serviceIds }
}

/**
 * Статусы backend: CREATED → PENDING ("Oczekująca", ждёт подтверждения салоном), COMPLETED → DONE,
 * NO_SHOW → NO_SHOW ("Nieobecność", item74; метку клиента «Niewiarygodny» клиенту не показываем).
 */
enum class BookingStatus { CONFIRMED, PENDING, DONE, CANCELLED, NO_SHOW }

data class Booking(
    val id: String,
    val serviceId: String,
    val serviceName: String,
    val masterId: String,
    val masterName: String,
    // Время салона (см. Mappers.parseSalonTime)
    val start: LocalDateTime,
    val price: Double,
    val status: BookingStatus,
) {
    val date: LocalDate get() = start.toLocalDate()
    val time: LocalTime get() = start.toLocalTime()

    val isActive: Boolean get() = status == BookingStatus.CONFIRMED || status == BookingStatus.PENDING

    /** "Nadchodzące": активная и ещё не начавшаяся; всё остальное — "Minione". */
    fun isUpcoming(now: LocalDateTime): Boolean = isActive && start.isAfter(now)
}

/** Свободный слот: [startIso] уходит на бэкенд как есть, [time] — для отображения. */
data class Slot(val startIso: String, val time: LocalTime)

/** Ответ /client/slots на один день: [isWorkingDay] = false — выходной мастера по графику. */
data class DaySlots(val isWorkingDay: Boolean, val slots: List<Slot>)

data class Reward(val id: String, val name: String, val cost: Int)

data class EarnRule(val label: String, val points: Int)

data class NewsTag(val label: String, val color: Color, val emoji: String)

data class NewsItem(val id: Long, val tag: NewsTag, val title: String, val text: String, val date: LocalDate)

data class SalonContacts(val phone: String, val instagramUrl: String?, val facebookUrl: String?)
