package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class NewsFormLogicTest {

    private val image = "data:image/jpeg;base64,AAAA"

    private fun post(
        status: NewsStatus = NewsStatus.DRAFT,
        imageUrl: String? = null,
        publishedAt: Instant? = null,
        createdAt: Instant = Instant.parse("2026-10-01T10:00:00Z"),
        hasArticle: Boolean = false,
    ) = NewsPost(
        id = "n1",
        category = NewsCategory.NOWOSC,
        title = "Tytuł",
        body = "Treść",
        imageUrl = imageUrl,
        status = status,
        publishedAt = publishedAt,
        createdAt = createdAt,
        hasArticle = hasArticle,
    )

    private fun form(
        title: String = "Tytuł",
        body: String = "Treść",
        status: NewsStatus = NewsStatus.DRAFT,
        image: NewsImage = NewsImage.Saved(null),
        article: NewsArticle = NewsArticle.Saved(false),
    ) = NewsForm(NewsCategory.NOWOSC, title, body, status, image, article)

    // --- Проверки полей: те же границы, что у бэкенда ---

    @Test
    fun `valid form has no errors`() {
        assertEquals(emptySet<NewsFieldError>(), NewsFormLogic.validate(form()))
    }

    @Test
    fun `empty and whitespace-only title and body are rejected`() {
        assertEquals(
            setOf(NewsFieldError.TITLE_EMPTY, NewsFieldError.BODY_EMPTY),
            NewsFormLogic.validate(form(title = "   ", body = "")),
        )
    }

    @Test
    fun `title boundary is 120 characters`() {
        assertTrue(NewsFormLogic.validate(form(title = "a".repeat(120))).isEmpty())
        assertEquals(setOf(NewsFieldError.TITLE_TOO_LONG), NewsFormLogic.validate(form(title = "a".repeat(121))))
    }

    @Test
    fun `body boundary is 2000 characters`() {
        assertTrue(NewsFormLogic.validate(form(body = "b".repeat(2000))).isEmpty())
        assertEquals(setOf(NewsFieldError.BODY_TOO_LONG), NewsFormLogic.validate(form(body = "b".repeat(2001))))
    }

    @Test
    fun `surrounding spaces do not count toward the length`() {
        assertTrue(NewsFormLogic.validate(form(title = "  " + "a".repeat(120) + "  ")).isEmpty())
    }

    // --- Kategoria и Status: как в дизайне, по нажатию ---

    @Test
    fun `category cycles Nowosc - Digest - Inspiracja - Nowosc`() {
        assertEquals(NewsCategory.DIGEST, NewsFormLogic.nextCategory(NewsCategory.NOWOSC))
        assertEquals(NewsCategory.INSPIRACJA, NewsFormLogic.nextCategory(NewsCategory.DIGEST))
        assertEquals(NewsCategory.NOWOSC, NewsFormLogic.nextCategory(NewsCategory.INSPIRACJA))
    }

    @Test
    fun `status toggles between draft and published`() {
        assertEquals(NewsStatus.PUBLISHED, NewsFormLogic.toggleStatus(NewsStatus.DRAFT))
        assertEquals(NewsStatus.DRAFT, NewsFormLogic.toggleStatus(NewsStatus.PUBLISHED))
    }

    @Test
    fun `new form is a draft in the first category without image`() {
        val f = NewsForm()
        assertEquals(NewsCategory.NOWOSC, f.category)
        assertEquals(NewsStatus.DRAFT, f.status)
        assertNull(f.image.preview)
    }

    @Test
    fun `edit form is filled from the post`() {
        val f = NewsFormLogic.fromPost(post(status = NewsStatus.PUBLISHED, imageUrl = image))
        assertEquals(form(status = NewsStatus.PUBLISHED, image = NewsImage.Saved(image)), f)
    }

    // --- План сохранения ---

    @Test
    fun `new post without image is created in one request with trimmed fields`() {
        val plan = NewsFormLogic.planSave(null, form(title = " Tytuł ", body = " Treść ", status = NewsStatus.PUBLISHED))
        assertEquals(NewsSavePlan(create = NewsFields(NewsCategory.NOWOSC, "Tytuł", "Treść", NewsStatus.PUBLISHED)), plan)
    }

    @Test
    fun `new draft with image is created and then gets the image`() {
        val plan = NewsFormLogic.planSave(null, form(image = NewsImage.Picked(image)))
        assertEquals(NewsStatus.DRAFT, plan.create?.status)
        assertEquals(image, plan.uploadImage)
        assertNull(plan.patch)
    }

    @Test
    fun `new published post with image is published only after the image upload`() {
        val plan = NewsFormLogic.planSave(null, form(status = NewsStatus.PUBLISHED, image = NewsImage.Picked(image)))
        assertEquals(NewsStatus.DRAFT, plan.create?.status)
        assertEquals(image, plan.uploadImage)
        assertEquals(NewsFields(status = NewsStatus.PUBLISHED), plan.patch)
    }

    @Test
    fun `unchanged edit is a no-op`() {
        val original = post(imageUrl = image)
        assertTrue(NewsFormLogic.planSave(original, NewsFormLogic.fromPost(original)).isNoop)
    }

    @Test
    fun `edit sends only the changed fields`() {
        val plan = NewsFormLogic.planSave(post(), form(title = "Nowy tytuł", status = NewsStatus.PUBLISHED))
        assertEquals(NewsSavePlan(patch = NewsFields(title = "Nowy tytuł", status = NewsStatus.PUBLISHED)), plan)
    }

    @Test
    fun `edit replaces the image`() {
        val plan = NewsFormLogic.planSave(post(imageUrl = "data:image/png;base64,BBBB"), form(image = NewsImage.Picked(image)))
        assertEquals(NewsSavePlan(uploadImage = image), plan)
    }

    @Test
    fun `edit removes the saved image`() {
        val plan = NewsFormLogic.planSave(post(imageUrl = image), form(image = NewsImage.Removed))
        assertEquals(NewsSavePlan(removeImage = true), plan)
    }

    @Test
    fun `removing an image the post never had is a no-op`() {
        assertFalse(NewsFormLogic.planSave(post(), form(image = NewsImage.Removed)).removeImage)
    }

    // --- Тосты и ошибки ---

    @Test
    fun `toast depends on the saved status`() {
        assertEquals(NewsSaveToast.PUBLISHED, NewsFormLogic.toast(NewsStatus.PUBLISHED))
        assertEquals(NewsSaveToast.DRAFT, NewsFormLogic.toast(NewsStatus.DRAFT))
    }

    @Test
    fun `backend errors map to form messages`() {
        assertEquals(NewsError.NETWORK, NewsFormLogic.mapError(null, null))
        assertEquals(NewsError.IMAGE_INVALID, NewsFormLogic.mapError(400, "Image must not exceed 5MB"))
        assertEquals(
            NewsError.IMAGE_INVALID,
            NewsFormLogic.mapError(400, "image must be a base64 data URL with image/jpeg, image/png or image/webp mime type"),
        )
        assertEquals(NewsError.VALIDATION, NewsFormLogic.mapError(400, "title must be longer than or equal to 1 characters"))
        assertEquals(NewsError.NOT_FOUND, NewsFormLogic.mapError(404, "News post not found"))
        assertEquals(NewsError.UNKNOWN, NewsFormLogic.mapError(500, null))
    }

    // --- Картинка ---

    @Test
    fun `image size is measured after base64 decoding`() {
        assertEquals(3, NewsFormLogic.imageBytes("data:image/jpeg;base64,AAAA"))
        assertEquals(1, NewsFormLogic.imageBytes("data:image/jpeg;base64,AA=="))
        assertEquals(2, NewsFormLogic.imageBytes("data:image/jpeg;base64,AAA="))
    }

    @Test
    fun `image limit is 5 MB`() {
        fun ofBytes(n: Int) = "data:image/jpeg;base64," + java.util.Base64.getEncoder().encodeToString(ByteArray(n))
        assertFalse(NewsFormLogic.imageTooLarge(ofBytes(5 * 1024 * 1024)))
        assertTrue(NewsFormLogic.imageTooLarge(ofBytes(5 * 1024 * 1024 + 1)))
    }

    @Test
    fun `image preview follows the picked, saved or removed state`() {
        assertEquals(image, NewsImage.Picked(image).preview)
        assertEquals(image, NewsImage.Saved(image).preview)
        assertNull(NewsImage.Removed.preview)
    }

    // --- Список ---

    @Test
    fun `card date is the publication date, or the creation date for a draft`() {
        val zone = ZoneId.of("Europe/Warsaw")
        // 23:30 UTC — уже следующий день по Варшаве
        val published = post(publishedAt = Instant.parse("2026-10-04T23:30:00Z"), createdAt = Instant.parse("2026-10-01T10:00:00Z"))
        assertEquals(LocalDate.of(2026, 10, 5), NewsFormLogic.displayDate(published, zone))
        assertEquals(LocalDate.of(2026, 10, 1), NewsFormLogic.displayDate(post(), zone))
    }

    @Test
    fun `list keeps the newest post first and replaces an edited one in place`() {
        val older = post().copy(id = "a", createdAt = Instant.parse("2026-10-01T10:00:00Z"))
        val newer = post().copy(id = "b", createdAt = Instant.parse("2026-10-02T10:00:00Z"))
        assertEquals(listOf("b", "a"), NewsFormLogic.sorted(listOf(older, newer)).map { it.id })

        val edited = older.copy(title = "Zmieniony")
        val list = NewsFormLogic.replace(listOf(newer, older), edited)
        assertEquals(listOf("b", "a"), list.map { it.id })
        assertEquals("Zmieniony", list[1].title)
    }

    // --- Статья (item89) ---

    private val picked = NewsArticle.Picked("artykul.html", 2_300_000L, "<article>Treść</article>")

    @Test
    fun `edit form carries whether the post has an article`() {
        assertEquals(NewsArticle.Saved(true), NewsFormLogic.fromPost(post(hasArticle = true)).article)
        assertEquals(NewsArticle.Saved(false), NewsFormLogic.fromPost(post()).article)
    }

    @Test
    fun `picked file travels in the create request`() {
        val plan = NewsFormLogic.planSave(null, form(article = picked))
        assertEquals("<article>Treść</article>", plan.create?.contentHtml)
    }

    @Test
    fun `published post with article and image is still published only after the image upload`() {
        val plan = NewsFormLogic.planSave(null, form(status = NewsStatus.PUBLISHED, image = NewsImage.Picked(image), article = picked))
        assertEquals(NewsStatus.DRAFT, plan.create?.status)
        assertEquals("<article>Treść</article>", plan.create?.contentHtml)
        assertNull(plan.patch?.contentHtml)
    }

    @Test
    fun `new post without a file sends no contentHtml`() {
        assertNull(NewsFormLogic.planSave(null, form()).create?.contentHtml)
    }

    @Test
    fun `replacing the article patches only contentHtml`() {
        val original = post(hasArticle = true)
        val plan = NewsFormLogic.planSave(original, NewsFormLogic.fromPost(original).copy(article = picked))
        assertEquals(NewsSavePlan(patch = NewsFields(contentHtml = "<article>Treść</article>")), plan)
    }

    @Test
    fun `removing a saved article sends an empty contentHtml`() {
        val original = post(hasArticle = true)
        val plan = NewsFormLogic.planSave(original, NewsFormLogic.fromPost(original).copy(article = NewsArticle.Removed))
        assertEquals(NewsSavePlan(patch = NewsFields(contentHtml = "")), plan)
    }

    @Test
    fun `leaving the article alone does not resend it`() {
        val original = post(hasArticle = true)
        val plan = NewsFormLogic.planSave(original, NewsFormLogic.fromPost(original).copy(title = "Inny"))
        assertNull(plan.patch?.contentHtml)
    }

    @Test
    fun `picking or removing a file makes the form dirty`() {
        val original = post(hasArticle = true)
        assertFalse(NewsFormLogic.isDirty(original, NewsFormLogic.fromPost(original)))
        assertTrue(NewsFormLogic.isDirty(original, NewsFormLogic.fromPost(original).copy(article = picked)))
        assertTrue(NewsFormLogic.isDirty(original, NewsFormLogic.fromPost(original).copy(article = NewsArticle.Removed)))
        assertTrue(NewsFormLogic.isDirty(null, form(article = picked)))
    }

    @Test
    fun `article attached flag`() {
        assertTrue(picked.attached)
        assertTrue(NewsArticle.Saved(true).attached)
        assertFalse(NewsArticle.Saved(false).attached)
        assertFalse(NewsArticle.Removed.attached)
    }

    // --- Выбор файла ---

    @Test
    fun `only html files up to 12 MB are accepted`() {
        val limit = 12L * 1024 * 1024
        assertNull(NewsFormLogic.validateArticleFile("artykul.html", 1_000L))
        assertNull(NewsFormLogic.validateArticleFile("ARTYKUL.HTM", null))
        assertNull(NewsFormLogic.validateArticleFile("a.html", limit))
        assertEquals(NewsError.ARTICLE_TOO_LARGE, NewsFormLogic.validateArticleFile("a.html", limit + 1))
        assertEquals(NewsError.ARTICLE_EMPTY, NewsFormLogic.validateArticleFile("a.html", 0))
        assertEquals(NewsError.ARTICLE_NOT_HTML, NewsFormLogic.validateArticleFile("a.pdf", 10))
        assertEquals(NewsError.ARTICLE_NOT_HTML, NewsFormLogic.validateArticleFile(null, 10))
    }

    @Test
    fun `file size label`() {
        assertEquals("2,2 MB", NewsFormLogic.fileSizeLabel(2_300_000L))
        assertEquals("340 KB", NewsFormLogic.fileSizeLabel(348_160L))
        assertEquals("12,0 MB", NewsFormLogic.fileSizeLabel(12L * 1024 * 1024))
        assertEquals("900 B", NewsFormLogic.fileSizeLabel(900))
    }

    // --- Ошибки backend по статье ---

    @Test
    fun `article errors map to their own messages`() {
        assertEquals(NewsError.ARTICLE_TOO_LARGE, NewsFormLogic.mapError(413, "request entity too large"))
        assertEquals(NewsError.ARTICLE_TOO_LARGE, NewsFormLogic.mapError(422, "Article file must not exceed 12MB", "ARTICLE_TOO_LARGE"))
        assertEquals(NewsError.ARTICLE_RESULT_TOO_LARGE, NewsFormLogic.mapError(422, "…", "ARTICLE_RESULT_TOO_LARGE"))
        assertEquals(NewsError.ARTICLE_INVALID_HTML, NewsFormLogic.mapError(422, "…", "ARTICLE_INVALID_HTML"))
        assertEquals(NewsError.ARTICLE_IMAGE_INVALID, NewsFormLogic.mapError(422, "…", "ARTICLE_IMAGE_INVALID"))
        // 422 без известного кода — всё равно про статью (других 422 у /news нет)
        assertEquals(NewsError.ARTICLE_INVALID_HTML, NewsFormLogic.mapError(422, null, null))
        // 422 «картинки статьи» не путается с 400 «картинки новости»
        assertEquals(NewsError.IMAGE_INVALID, NewsFormLogic.mapError(400, "Image must not exceed 5MB"))
    }
}
