package com.beauty4you.admin.domain

import java.time.Instant

// Новости салона (item75). Порядок категорий — как в дизайне: «Kategoria» в форме перебирает их по кругу.
enum class NewsCategory { NOWOSC, DIGEST, INSPIRACJA }

enum class NewsStatus { DRAFT, PUBLISHED }

// publishedAt/createdAt — настоящие моменты времени (Prisma DateTime), а не «время салона с меткой
// UTC», как у записей: показываются в часовом поясе устройства.
data class NewsPost(
    val id: String,
    val category: NewsCategory,
    val title: String,
    val body: String,
    // base64 data URL, как фото мастера
    val imageUrl: String?,
    val status: NewsStatus,
    val publishedAt: Instant?,
    val createdAt: Instant,
)
