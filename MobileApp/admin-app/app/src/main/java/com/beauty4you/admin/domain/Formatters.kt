package com.beauty4you.admin.domain

import java.math.BigDecimal

object Formatters {

    // Prisma Decimal "150.00" -> "150 zł", "99.50" -> "99,50 zł"
    fun price(raw: String): String {
        val value = raw.trim().toBigDecimalOrNull() ?: return "$raw zł"
        val text = if (value.stripTrailingZeros().scale() <= 0) {
            value.setScale(0).toPlainString()
        } else {
            value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString().replace('.', ',')
        }
        return "$text zł"
    }

    // «Cześć, {имя}»: у пользователя-сотрудника в бэкенде нет имени, только email —
    // берём локальную часть ("admin@b4u.local" -> "Admin", "anna.nowak@x.pl" -> "Anna")
    fun greetingName(email: String?): String {
        val local = email?.substringBefore('@')?.split('.', '_', '-', '+')?.firstOrNull { it.isNotBlank() }
        return local?.replaceFirstChar { it.uppercase() } ?: "Admin"
    }

    private fun String.toBigDecimalOrNull(): BigDecimal? = runCatching { BigDecimal(this) }.getOrNull()
}

// Порт 1-в-1 из frontend/src/pages/dashboard/masterColor.ts (как в master-app и client-app):
// цвет мастера совпадает с его цветом на таймлайне веб-CRM. ARGB-число, а не Compose Color —
// чтобы функция оставалась чистой JVM-логикой.
object MasterColors {
    private val PALETTE = longArrayOf(
        0xFF2563EB, // blue
        0xFF16A34A, // green
        0xFFD97706, // amber
        0xFFDB2777, // pink
        0xFF7C3AED, // violet
        0xFF0891B2, // cyan
        0xFFDC2626, // red
        0xFF65A30D, // lime
    )

    fun argb(masterId: String): Long {
        var hash = 0L
        for (ch in masterId) hash = (hash * 31 + ch.code) and 0xFFFFFFFFL
        return PALETTE[(hash % PALETTE.size).toInt()]
    }
}

// Цвета аватаров клиентов из дизайна (AVATAR_COLORS), стабильно по id клиента
object AvatarColors {
    private val PALETTE = longArrayOf(0xFF4F8A82, 0xFF6E7FC9, 0xFFA85B93, 0xFF8B7355, 0xFFC97B8E)

    fun argb(clientId: String): Long {
        var hash = 0L
        for (ch in clientId) hash = (hash * 31 + ch.code) and 0xFFFFFFFFL
        return PALETTE[(hash % PALETTE.size).toInt()]
    }
}
