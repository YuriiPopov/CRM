package com.beauty4you.client.data

// То, чего ещё нет на backend: программа лояльности и контакты салона (у модели Salon нет
// телефона/соцсетей). Значения — из HTML-прототипа; профиль, каталог, записи и новости приходят с API.
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
}
