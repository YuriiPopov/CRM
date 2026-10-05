package com.beauty4you.admin.data.repo

import com.beauty4you.admin.data.remote.ApiService
import com.beauty4you.admin.data.remote.NewsImageBody
import com.beauty4you.admin.data.remote.NewsPostDto
import com.beauty4you.admin.data.remote.toBody
import com.beauty4you.admin.data.remote.toDomain
import com.beauty4you.admin.domain.NewsFields
import com.beauty4you.admin.domain.NewsPost

// Новости салона (item75): GET/POST /news, PATCH/DELETE /news/:id, POST/DELETE /news/:id/image — только ADMIN
class NewsRepository(private val api: ApiService) {

    suspend fun list(): List<NewsPost> = api.listNews().mapNotNull { it.toDomain() }

    suspend fun create(fields: NewsFields): NewsPost = api.createNews(fields.toBody()).toDomainOrThrow()

    suspend fun update(id: String, fields: NewsFields): NewsPost = api.updateNews(id, fields.toBody()).toDomainOrThrow()

    suspend fun delete(id: String) = api.deleteNews(id)

    suspend fun uploadImage(id: String, dataUrl: String): NewsPost =
        api.uploadNewsImage(id, NewsImageBody(dataUrl)).toDomainOrThrow()

    suspend fun removeImage(id: String) = api.deleteNewsImage(id)

    private fun NewsPostDto.toDomainOrThrow(): NewsPost =
        toDomain() ?: error("Unsupported news post: category=$category status=$status")
}
