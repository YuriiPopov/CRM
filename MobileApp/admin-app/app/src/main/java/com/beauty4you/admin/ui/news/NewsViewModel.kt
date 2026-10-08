package com.beauty4you.admin.ui.news

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.beauty4you.admin.AppContainer
import com.beauty4you.admin.R
import com.beauty4you.admin.data.DecodedImages
import com.beauty4you.admin.data.remote.toApiFailure
import com.beauty4you.admin.data.ArticleFileResult
import com.beauty4you.admin.domain.NewsArticle
import com.beauty4you.admin.domain.NewsError
import com.beauty4you.admin.domain.NewsFieldError
import com.beauty4you.admin.domain.NewsForm
import com.beauty4you.admin.domain.NewsFormLogic
import com.beauty4you.admin.domain.NewsImage
import com.beauty4you.admin.domain.NewsPost
import com.beauty4you.admin.domain.NewsSaveToast
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// Предпросмотр статьи (item89): тот же WebView, что в client-app
sealed interface ArticlePreview {
    data object Loading : ArticlePreview
    data class Ready(val html: String) : ArticlePreview
    data object Failed : ArticlePreview
}

data class NewsEditorState(
    // null — «Nowy wpis». После первого успешного шага сохранения сюда попадает созданная
    // новость: повторное «Zapisz» после ошибки не создаст дубликат
    val original: NewsPost? = null,
    val form: NewsForm = NewsForm(),
    // Ошибки полей показываем только после первой попытки сохранить
    val showFieldErrors: Boolean = false,
    val encodingImage: Boolean = false,
    val readingArticle: Boolean = false,
    val preview: ArticlePreview? = null,
    val saving: Boolean = false,
    val error: NewsError? = null,
    val confirmDelete: Boolean = false,
) {
    val isEdit: Boolean get() = original != null
    val fieldErrors: Set<NewsFieldError> get() = NewsFormLogic.validate(form)
    val visibleFieldErrors: Set<NewsFieldError> get() = if (showFieldErrors) fieldErrors else emptySet()
    val busy: Boolean get() = saving || encodingImage || readingArticle

    // Несохранённые изменения — при закрытии шторки спросим «Odrzucić zmiany?»
    val isDirty: Boolean get() = NewsFormLogic.isDirty(original, form)
}

data class NewsUiState(
    val loading: Boolean = true,
    val error: Boolean = false,
    val posts: List<NewsPost> = emptyList(),
    val editor: NewsEditorState? = null,
)

class NewsViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(NewsUiState())
    val state: StateFlow<NewsUiState> = _state.asStateFlow()

    private val repository get() = container.newsRepository

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = it.posts.isEmpty() && !it.error, error = false) }
            try {
                val posts = NewsFormLogic.sorted(repository.list())
                _state.update { it.copy(loading = false, posts = posts) }
            } catch (e: Exception) {
                android.util.Log.e("News", "load failed", e)
                _state.update { it.copy(loading = false, error = it.posts.isEmpty()) }
            }
        }
    }

    fun openCreate() = _state.update { it.copy(editor = NewsEditorState()) }

    fun openEdit(post: NewsPost) =
        _state.update { it.copy(editor = NewsEditorState(original = post, form = NewsFormLogic.fromPost(post))) }

    fun close() {
        // Выбранная, но не сохранённая картинка больше нигде не покажется
        (editor()?.form?.image as? NewsImage.Picked)?.let { DecodedImages.evict(it.dataUrl) }
        _state.update { it.copy(editor = null) }
    }

    fun cycleCategory() = updateForm { it.copy(category = NewsFormLogic.nextCategory(it.category)) }

    fun setTitle(title: String) = updateForm { it.copy(title = title) }

    fun setBody(body: String) = updateForm { it.copy(body = body) }

    fun toggleStatus() = updateForm { it.copy(status = NewsFormLogic.toggleStatus(it.status)) }

    fun removeImage() = updateForm {
        (it.image as? NewsImage.Picked)?.let { picked -> DecodedImages.evict(picked.dataUrl) }
        // Только что выбранную, но не сохранённую картинку просто отбрасываем
        val savedImage = (it.image as? NewsImage.Saved)?.dataUrl ?: editor()?.original?.imageUrl
        it.copy(image = if (savedImage != null) NewsImage.Removed else NewsImage.Saved(null))
    }

    fun onImagePicked(uri: Uri) {
        updateEditor { it.copy(encodingImage = true, error = null) }
        viewModelScope.launch {
            val dataUrl = container.imageEncoder.encode(uri)
            updateEditor {
                if (dataUrl == null || NewsFormLogic.imageTooLarge(dataUrl)) {
                    it.copy(encodingImage = false, error = NewsError.IMAGE_INVALID)
                } else {
                    // Замена ещё не сохранённой картинки — прежнюю из кэша убираем
                    (it.form.image as? NewsImage.Picked)?.let { old -> DecodedImages.evict(old.dataUrl) }
                    it.copy(encodingImage = false, form = it.form.copy(image = NewsImage.Picked(dataUrl)))
                }
            }
        }
    }

    // --- Статья (item89) ---

    fun onArticlePicked(uri: Uri) {
        updateEditor { it.copy(readingArticle = true, error = null) }
        viewModelScope.launch {
            val result = container.articleFileReader.read(uri)
            updateEditor {
                when (result) {
                    is ArticleFileResult.Failure -> it.copy(readingArticle = false, error = result.error)
                    is ArticleFileResult.Success -> it.copy(
                        readingArticle = false,
                        form = it.form.copy(article = NewsArticle.Picked(result.fileName, result.sizeBytes, result.html)),
                    )
                }
            }
        }
    }

    fun removeArticle() = updateForm {
        // Только что выбранный, но не сохранённый файл просто отбрасываем; сохранённую статью помечаем на удаление
        val savedExists = editor()?.original?.hasArticle == true
        it.copy(article = if (savedExists) NewsArticle.Removed else NewsArticle.Saved(false))
    }

    fun openPreview() {
        val editor = editor() ?: return
        when (val article = editor.form.article) {
            is NewsArticle.Picked -> updateEditor { it.copy(preview = ArticlePreview.Ready(article.html)) }
            is NewsArticle.Saved -> {
                val id = editor.original?.id
                if (!article.exists || id == null) return
                updateEditor { it.copy(preview = ArticlePreview.Loading) }
                loadSavedPreview(id)
            }
            NewsArticle.Removed -> Unit
        }
    }

    fun retryPreview() {
        val id = editor()?.original?.id ?: return
        updateEditor { it.copy(preview = ArticlePreview.Loading) }
        loadSavedPreview(id)
    }

    fun closePreview() = updateEditor { it.copy(preview = null) }

    private fun loadSavedPreview(id: String) {
        viewModelScope.launch {
            val preview = try {
                repository.articleHtml(id)?.takeIf { it.isNotBlank() }?.let { ArticlePreview.Ready(it) } ?: ArticlePreview.Failed
            } catch (e: Exception) {
                ArticlePreview.Failed
            }
            // Окно предпросмотра могли закрыть, пока шёл запрос
            updateEditor { if (it.preview == null) it else it.copy(preview = preview) }
        }
    }

    fun save() {
        val editor = editor() ?: return
        if (editor.busy) return
        if (editor.fieldErrors.isNotEmpty()) {
            updateEditor { it.copy(showFieldErrors = true) }
            return
        }
        val plan = NewsFormLogic.planSave(editor.original, editor.form)
        val status = editor.form.status
        if (plan.isNoop) {
            finish(editor.original, NewsFormLogic.toast(status))
            return
        }
        updateEditor { it.copy(saving = true, error = null, showFieldErrors = true) }
        viewModelScope.launch {
            try {
                var post = editor.original
                plan.create?.let { fields ->
                    post = repository.create(fields)
                    rememberSaved(post!!)
                    // Статья ушла вместе с create — при повторном «Zapisz» после сбоя картинки не шлём её снова
                    if (fields.contentHtml != null) {
                        updateEditor { e -> e.copy(form = e.form.copy(article = NewsArticle.Saved(post!!.hasArticle))) }
                    }
                }
                plan.uploadImage?.let { dataUrl ->
                    val replaced = post!!.imageUrl
                    post = repository.uploadImage(post!!.id, dataUrl)
                    if (replaced != dataUrl) DecodedImages.evict(replaced)
                    rememberSaved(post!!)
                }
                if (plan.removeImage) {
                    DecodedImages.evict(post!!.imageUrl)
                    repository.removeImage(post!!.id)
                    post = post!!.copy(imageUrl = null)
                    rememberSaved(post!!)
                }
                plan.patch?.let { fields -> post = repository.update(post!!.id, fields) }
                finish(post, NewsFormLogic.toast(status))
            } catch (e: Exception) {
                val failure = e.toApiFailure()
                updateEditor { it.copy(saving = false, error = NewsFormLogic.mapError(failure.httpCode, failure.message, failure.code)) }
            }
        }
    }

    fun askDelete() = updateEditor { it.copy(confirmDelete = true) }

    fun dismissDelete() = updateEditor { it.copy(confirmDelete = false) }

    fun confirmDelete() {
        val post = editor()?.original ?: return
        updateEditor { it.copy(confirmDelete = false, saving = true, error = null) }
        viewModelScope.launch {
            val error = try {
                repository.delete(post.id)
                null
            } catch (e: Exception) {
                val failure = e.toApiFailure()
                NewsFormLogic.mapError(failure.httpCode, failure.message)
            }
            // Уже удалена (например, во второй вкладке) — результат тот же
            if (error == null || error == NewsError.NOT_FOUND) {
                DecodedImages.evict(post.imageUrl)
                _state.update { s -> s.copy(posts = s.posts.filterNot { it.id == post.id }, editor = null) }
                container.events.toast(R.string.toast_news_deleted)
            } else {
                updateEditor { it.copy(saving = false, error = error) }
            }
        }
    }

    // Шаг сохранения прошёл: дальше форма работает с серверной версией новости
    private fun rememberSaved(post: NewsPost) {
        _state.update { s ->
            s.copy(
                posts = NewsFormLogic.replace(s.posts, post),
                editor = s.editor?.let { e ->
                    val image = if (e.form.image is NewsImage.Picked && post.imageUrl == null) e.form.image else NewsImage.Saved(post.imageUrl)
                    e.copy(original = post, form = e.form.copy(image = image))
                },
            )
        }
    }

    private fun finish(post: NewsPost?, toast: NewsSaveToast) {
        _state.update { s -> s.copy(posts = post?.let { NewsFormLogic.replace(s.posts, it) } ?: s.posts, editor = null) }
        container.events.toast(
            when (toast) {
                NewsSaveToast.PUBLISHED -> R.string.toast_news_published
                NewsSaveToast.DRAFT -> R.string.toast_news_draft
            },
        )
    }

    private fun editor(): NewsEditorState? = _state.value.editor

    private fun updateEditor(transform: (NewsEditorState) -> NewsEditorState) =
        _state.update { s -> s.copy(editor = s.editor?.let(transform)) }

    private fun updateForm(transform: (NewsForm) -> NewsForm) =
        updateEditor { it.copy(form = transform(it.form), error = null) }

    companion object {
        fun factory(container: AppContainer) = viewModelFactory {
            initializer { NewsViewModel(container) }
        }
    }
}
