package com.beauty4you.client.data

import androidx.compose.ui.graphics.Color
import java.time.LocalDate

// То, чего ещё нет на backend: программа лояльности, новости и контакты салона (у модели Salon
// нет телефона/соцсетей). Значения — из HTML-прототипа; профиль, каталог и записи приходят с API.
object MockData {
    // Instagram/Facebook в прототипе — заглушки "#"; до появления реальных ссылок кнопки
    // показывают тост "wkrótce".
    val contacts = SalonContacts(phone = "+48601234567", instagramUrl = null, facebookUrl = null)

    const val initialPoints = 640

    val rewards = listOf(
        Reward("r1", "Rabat 20 zł", 200),
        Reward("r2", "Manicure w prezencie", 600),
        Reward("r3", "Prezentowy peeling twarzy", 1000),
    )

    val earnRules = listOf(
        EarnRule("1 zł wydany", 1),
        EarnRule("Zaproś przyjaciela", 100),
        EarnRule("Opinia po wizycie", 30),
    )

    private val tagNew = NewsTag("Nowość", Color(0xFF4F8A82), "✨")
    private val tagDigest = NewsTag("Digest", Color(0xFF6E7FC9), "📰")

    fun news(today: LocalDate = LocalDate.now()) = listOf(
        NewsItem(1, tagNew, "Nowa linia zabiegów na twarz", "Wprowadzamy nową serię zabiegów pielęgnacyjnych — sprawdź ofertę w salonie.", today.minusDays(2)),
        NewsItem(2, tagDigest, "Podsumowanie tygodnia", "Najciekawsze metamorfozy i opinie klientek z ostatnich dni.", today.minusDays(4)),
    )
}
