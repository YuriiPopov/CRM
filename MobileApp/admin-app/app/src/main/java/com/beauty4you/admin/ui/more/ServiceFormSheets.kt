package com.beauty4you.admin.ui.more

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.beauty4you.admin.R
import com.beauty4you.admin.data.repo.Catalog
import com.beauty4you.admin.domain.CatalogError
import com.beauty4you.admin.domain.CategoryDeleteBlock
import com.beauty4you.admin.domain.CategoryFieldError
import com.beauty4you.admin.domain.ServiceFieldError
import com.beauty4you.admin.ui.common.ConfirmDeleteDialog
import com.beauty4you.admin.ui.common.DeleteSaveButtons
import com.beauty4you.admin.ui.common.FormErrorBanner
import com.beauty4you.admin.ui.common.FormHint
import com.beauty4you.admin.ui.common.FormSheet
import com.beauty4you.admin.ui.common.FormTextField
import com.beauty4you.admin.ui.common.SelectChip
import com.beauty4you.admin.ui.form.FieldLabel
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.StatusCancelled

// Формы «Nowa usługa / Edytuj usługę» и «Nowa kategoria / Edytuj kategorię» (item76)
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ServiceFormSheet(editor: ServiceEditorState, catalog: Catalog, errors: Set<ServiceFieldError>, viewModel: CatalogEditViewModel) {
    val form = editor.form
    val visible = if (editor.showFieldErrors) errors else emptySet()
    val enabled = !editor.saving

    FormSheet(
        title = stringResource(if (editor.isEdit) R.string.service_form_title_edit else R.string.service_form_title_new),
        busy = editor.saving,
        onDismiss = viewModel::closeService,
    ) {
        FieldLabel(R.string.service_form_category, top = 14.dp)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            catalog.categories.sortedBy { it.name.lowercase() }.forEach { category ->
                SelectChip(
                    label = category.name,
                    selected = category.id == form.categoryId,
                    enabled = enabled,
                    onClick = { viewModel.setServiceCategory(category.id) },
                )
            }
        }
        if (ServiceFieldError.CATEGORY_EMPTY in visible) {
            Text(stringResource(R.string.service_error_category), style = B4UType.CaptionSmall, color = StatusCancelled.fg, modifier = Modifier.padding(top = 4.dp))
        }

        FieldLabel(R.string.service_form_name)
        FormTextField(
            value = form.name,
            onValueChange = viewModel::setServiceName,
            error = if (ServiceFieldError.NAME_EMPTY in visible) stringResource(R.string.service_error_name) else null,
            enabled = enabled,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                FieldLabel(R.string.service_form_duration)
                FormTextField(
                    value = form.duration,
                    onValueChange = viewModel::setServiceDuration,
                    error = if (ServiceFieldError.DURATION_INVALID in visible) stringResource(R.string.service_error_duration) else null,
                    enabled = enabled,
                    keyboardType = KeyboardType.Number,
                    suffix = stringResource(R.string.service_unit_min),
                )
            }
            Column(Modifier.weight(1f)) {
                FieldLabel(R.string.service_form_price)
                FormTextField(
                    value = form.price,
                    onValueChange = viewModel::setServicePrice,
                    error = if (ServiceFieldError.PRICE_INVALID in visible) stringResource(R.string.service_error_price) else null,
                    enabled = enabled,
                    keyboardType = KeyboardType.Decimal,
                    suffix = stringResource(R.string.service_unit_currency),
                )
            }
        }

        editor.error?.let { FormErrorBanner(stringResource(it.messageRes())) }

        DeleteSaveButtons(
            showDelete = editor.isEdit,
            busy = editor.saving,
            saving = editor.saving,
            onDelete = viewModel::askDeleteService,
            onSave = viewModel::saveService,
        )
    }

    if (editor.confirmDelete) {
        ConfirmDeleteDialog(
            title = stringResource(R.string.service_delete_confirm_title),
            text = stringResource(R.string.service_delete_confirm_text, editor.original?.name.orEmpty()),
            confirmLabel = stringResource(R.string.service_delete_confirm_yes),
            onConfirm = viewModel::confirmDeleteService,
            onDismiss = viewModel::dismissDeleteService,
        )
    }
}

@Composable
fun CategoryFormSheet(editor: CategoryEditorState, errors: Set<CategoryFieldError>, viewModel: CatalogEditViewModel) {
    val visible = if (editor.showFieldErrors) errors else emptySet()

    FormSheet(
        title = stringResource(if (editor.isEdit) R.string.category_form_title_edit else R.string.category_form_title_new),
        busy = editor.saving,
        onDismiss = viewModel::closeCategory,
    ) {
        FieldLabel(R.string.category_form_name, top = 14.dp)
        FormTextField(
            value = editor.name,
            onValueChange = viewModel::setCategoryName,
            error = when {
                CategoryFieldError.NAME_EMPTY in visible -> stringResource(R.string.category_error_name)
                CategoryFieldError.NAME_TAKEN in visible -> stringResource(R.string.category_error_taken)
                else -> null
            },
            enabled = !editor.saving,
        )
        // Удалить можно только пустую категорию и не ту, что «по умолчанию» — объясняем почему
        when (editor.deleteBlock) {
            CategoryDeleteBlock.DEFAULT -> FormHint(stringResource(R.string.category_delete_blocked_default), Modifier.padding(top = 6.dp))
            CategoryDeleteBlock.HAS_SERVICES -> FormHint(stringResource(R.string.category_delete_blocked_services), Modifier.padding(top = 6.dp))
            null -> Unit
        }

        editor.error?.let { FormErrorBanner(stringResource(it.messageRes())) }

        DeleteSaveButtons(
            showDelete = editor.isEdit,
            busy = editor.saving,
            saving = editor.saving,
            onDelete = viewModel::askDeleteCategory,
            onSave = viewModel::saveCategory,
            deleteEnabled = editor.deleteBlock == null,
        )
    }

    if (editor.confirmDelete) {
        ConfirmDeleteDialog(
            title = stringResource(R.string.category_delete_confirm_title),
            text = stringResource(R.string.category_delete_confirm_text, editor.original?.name.orEmpty()),
            confirmLabel = stringResource(R.string.category_delete_confirm_yes),
            onConfirm = viewModel::confirmDeleteCategory,
            onDismiss = viewModel::dismissDeleteCategory,
        )
    }
}

@StringRes
internal fun CatalogError.messageRes(): Int = when (this) {
    CatalogError.MASTER_IN_USE -> R.string.catalog_error_master_in_use
    CatalogError.MASTER_HAS_BOOKINGS -> R.string.catalog_error_master_has_bookings
    CatalogError.SERVICE_IN_USE -> R.string.catalog_error_service_in_use
    CatalogError.CATEGORY_DEFAULT -> R.string.category_delete_blocked_default
    CatalogError.PHOTO_INVALID -> R.string.catalog_error_photo
    CatalogError.VALIDATION -> R.string.error_validation
    CatalogError.NOT_FOUND -> R.string.catalog_error_not_found
    CatalogError.NETWORK -> R.string.error_network
    CatalogError.UNKNOWN -> R.string.error_unknown
}
