package com.beauty4you.admin.domain

import java.text.Normalizer
import java.time.LocalDateTime

sealed interface NewClientValidation {
    data class Valid(val name: String, val phone: String) : NewClientValidation
    data object NameMissing : NewClientValidation
    data object PhoneInvalid : NewClientValidation
}

// «wizyt łącznie» — состоявшиеся визиты (COMPLETED); «zapisanych» — будущие активные записи
data class ClientStats(val completedVisits: Int, val upcoming: Int)

object ClientLogic {

    // "Anna Kowalska" -> "AK", "Madonna" -> "M"
    fun initials(name: String): String =
        name.trim()
            .split(Regex("\\s+"))
            .filter { it.isNotEmpty() }
            .take(2)
            .joinToString("") { it.first().uppercase() }

    // Поиск по имени (без учёта регистра и польских/кириллических диакритик) или по цифрам телефона
    fun search(clients: List<Client>, query: String): List<Client> {
        val q = query.trim()
        if (q.isEmpty()) return clients
        val needle = fold(q)
        val digits = q.filter { it.isDigit() }
        return clients.filter { client ->
            fold(client.name).contains(needle) ||
                (digits.isNotEmpty() && client.phone.filter { it.isDigit() }.contains(digits))
        }
    }

    // Нормализация телефона для POST /clients:
    //  - 9 цифр без префикса -> польский номер "+48 601 234 567";
    //  - "+48"/"0048" + 9 цифр -> то же;
    //  - другой международный "+<код>..." (8–15 цифр, напр. украинский +380) — принимаем как есть, без пробелов;
    //  - всё прочее — null (невалидный).
    fun normalizePhone(input: String): String? {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) return null
        if (trimmed.any { !it.isDigit() && it !in "+ -()" }) return null
        val hasPlus = trimmed.startsWith("+")
        if (trimmed.drop(1).contains('+')) return null
        val digits = trimmed.filter { it.isDigit() }

        val polishNational = polishNational(digits, hasPlus)
        if (polishNational != null) return groupPolish(polishNational)
        // "+48" с неверным числом цифр — опечатка в польском номере, а не иностранный номер
        if (hasPlus && digits.startsWith("48")) return null
        return if (hasPlus && digits.length in 8..15) "+$digits" else null
    }

    // Показ телефона в списке и карточке: польский номер (9 цифр, с +48/0048 или без) — группами
    // "+48 601 234 567"; всё остальное (иностранные, ошибочные из старых данных) — как есть
    fun formatPhone(phone: String): String {
        val trimmed = phone.trim()
        val national = polishNational(trimmed.filter { it.isDigit() }, trimmed.startsWith("+")) ?: return phone
        return groupPolish(national)
    }

    private fun polishNational(digits: String, hasPlus: Boolean): String? = when {
        !hasPlus && digits.length == 9 -> digits
        hasPlus && digits.length == 11 && digits.startsWith("48") -> digits.substring(2)
        !hasPlus && digits.length == 13 && digits.startsWith("0048") -> digits.substring(4)
        else -> null
    }

    private fun groupPolish(national: String): String =
        "+48 ${national.substring(0, 3)} ${national.substring(3, 6)} ${national.substring(6)}"

    fun validateNewClient(name: String, phone: String): NewClientValidation {
        val trimmedName = name.trim()
        if (trimmedName.isEmpty()) return NewClientValidation.NameMissing
        val normalized = normalizePhone(phone) ?: return NewClientValidation.PhoneInvalid
        return NewClientValidation.Valid(trimmedName, normalized)
    }

    fun completedVisitsByClient(bookings: List<Booking>): Map<String, Int> =
        bookings.filter { it.status == BookingStatus.COMPLETED }.groupingBy { it.clientId }.eachCount()

    fun stats(clientBookings: List<Booking>, now: LocalDateTime): ClientStats = ClientStats(
        completedVisits = clientBookings.count { it.status == BookingStatus.COMPLETED },
        upcoming = clientBookings.count {
            (it.status == BookingStatus.CREATED || it.status == BookingStatus.CONFIRMED) && !it.start.isBefore(now)
        },
    )

    // «Historia wizyt» — новые сверху
    fun history(clientBookings: List<Booking>): List<Booking> = clientBookings.sortedByDescending { it.start }

    private fun fold(value: String): String =
        Normalizer.normalize(value.lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
            // ł не раскладывается NFD на l + диакритику
            .replace('ł', 'l')
}
