package com.beauty4you.admin.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.beauty4you.admin.domain.NewsError
import com.beauty4you.admin.domain.NewsFormLogic
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

sealed interface ArticleFileResult {
    data class Success(val fileName: String, val sizeBytes: Long, val html: String) : ArticleFileResult
    data class Failure(val error: NewsError) : ArticleFileResult
}

// Читает HTML-файл статьи, выбранный системным выбором файлов (item89): имя, размер, текст в UTF-8.
// Лимит 12 МБ проверяется по заявленному размеру и ещё раз при чтении (провайдер мог соврать).
class ArticleFileReader(private val context: Context) {

    suspend fun read(uri: Uri): ArticleFileResult = withContext(Dispatchers.IO) {
        try {
            val (name, declaredSize) = queryNameAndSize(uri)
            NewsFormLogic.validateArticleFile(name, declaredSize)?.let { return@withContext ArticleFileResult.Failure(it) }

            val bytes = context.contentResolver.openInputStream(uri)?.use { readLimited(it) }
                ?: return@withContext ArticleFileResult.Failure(NewsError.ARTICLE_UNREADABLE)
            if (bytes.size > NewsFormLogic.ARTICLE_MAX_BYTES) {
                return@withContext ArticleFileResult.Failure(NewsError.ARTICLE_TOO_LARGE)
            }
            val html = bytes.toString(Charsets.UTF_8).removePrefix("﻿")
            if (html.isBlank()) return@withContext ArticleFileResult.Failure(NewsError.ARTICLE_EMPTY)
            ArticleFileResult.Success(name.orEmpty(), bytes.size.toLong(), html)
        } catch (e: Exception) {
            ArticleFileResult.Failure(NewsError.ARTICLE_UNREADABLE)
        }
    }

    private fun queryNameAndSize(uri: Uri): Pair<String?, Long?> {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val name = c.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let(c::getString)
                val size = c.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 && !c.isNull(it) }?.let(c::getLong)
                return name to size
            }
        }
        return uri.lastPathSegment to null
    }

    // Читает не больше лимита + 1 байт: больше — файл заведомо слишком большой
    private fun readLimited(input: java.io.InputStream): ByteArray {
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(64 * 1024)
        val limit = NewsFormLogic.ARTICLE_MAX_BYTES + 1
        while (out.size() < limit) {
            val n = input.read(buffer, 0, minOf(buffer.size, limit - out.size()))
            if (n < 0) break
            out.write(buffer, 0, n)
        }
        return out.toByteArray()
    }
}
