package com.beauty4you.admin.ui.clients

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.ClientLogic
import com.beauty4you.admin.domain.Client
import com.beauty4you.admin.ui.common.B4UCard
import com.beauty4you.admin.ui.common.DashedEmptyState
import com.beauty4you.admin.ui.common.ErrorState
import com.beauty4you.admin.ui.common.InitialsAvatar
import com.beauty4you.admin.ui.common.RefreshOnResume
import com.beauty4you.admin.ui.common.ScreenHeader
import com.beauty4you.admin.ui.common.SkeletonList
import com.beauty4you.admin.ui.common.UnreliableBadge
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.CardBg
import com.beauty4you.admin.ui.theme.DashedBorder
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.PillShape
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.SheetBackground
import com.beauty4you.admin.ui.theme.SheetShape
import com.beauty4you.admin.ui.theme.StatusCancelled

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientsScreen(onOpenClient: (String) -> Unit) {
    val viewModel: ClientsViewModel = viewModel(factory = ClientsViewModel.factory(appContainer()))
    val state by viewModel.state.collectAsState()
    RefreshOnResume { viewModel.load(silent = state.clients.isNotEmpty(), force = true) }

    PullToRefreshBox(isRefreshing = false, onRefresh = { viewModel.load(force = true) }, modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            item {
                ScreenHeader(
                    title = stringResource(R.string.clients_title),
                    subtitle = pluralStringResource(R.plurals.clients_count, state.clients.size, state.clients.size),
                ) {
                    Text(
                        stringResource(R.string.clients_new),
                        style = B4UType.BodyStrong,
                        color = Color.White,
                        modifier = Modifier
                            .clip(FieldShape)
                            .background(Rose)
                            .clickable(onClick = viewModel::openNewClient)
                            .padding(horizontal = 14.dp, vertical = 9.dp),
                    )
                }
            }
            item {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = viewModel::onQueryChange,
                    placeholder = { Text(stringResource(R.string.clients_search), style = B4UType.Body) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = Muted) },
                    singleLine = true,
                    shape = FieldShape,
                    colors = fieldColors(),
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                )
            }
            when {
                state.loading -> item { SkeletonList(rows = 6, height = 60.dp) }
                state.error -> item { ErrorState(onRetry = { viewModel.load(force = true) }) }
                state.filtered.isEmpty() -> item {
                    DashedEmptyState(
                        title = stringResource(if (state.query.isBlank()) R.string.clients_empty else R.string.clients_search_empty),
                    )
                }
                else -> items(state.filtered, key = { it.id }) { client ->
                    ClientRow(client, state.visits[client.id] ?: 0) { onOpenClient(client.id) }
                }
            }
        }
    }

    state.newClient?.let { form -> NewClientSheet(form, viewModel) }
}

@Composable
private fun ClientRow(client: Client, visits: Int, onClick: () -> Unit) {
    B4UCard(onClick = onClick) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            InitialsAvatar(client.id, client.name, size = 38.dp)
            Column(Modifier.weight(1f)) {
                Text(client.name, style = B4UType.ItemTitle, color = InkStrong, maxLines = 1)
                Text(ClientLogic.formatPhone(client.phone), style = B4UType.CaptionSmall, color = Muted, modifier = Modifier.padding(top = 1.dp))
                UnreliableBadge(client, Modifier.padding(top = 4.dp))
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(visits.toString(), style = B4UType.BodyStrong.copy(fontSize = 12.sp), color = Ink)
                Text(stringResource(R.string.clients_visits), style = B4UType.Tiny.copy(fontSize = 10.sp), color = Muted)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewClientSheet(form: NewClientForm, viewModel: ClientsViewModel) {
    ModalBottomSheet(
        onDismissRequest = viewModel::closeNewClient,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        shape = SheetShape,
        containerColor = SheetBackground,
        dragHandle = {
            Box(Modifier.padding(top = 12.dp, bottom = 4.dp).size(width = 36.dp, height = 4.dp).clip(PillShape).background(DashedBorder))
        },
    ) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp).navigationBarsPadding()) {
            Text(stringResource(R.string.client_new_title), style = B4UType.SheetTitle, color = Ink)

            Label(R.string.client_name, top = 14.dp)
            OutlinedTextField(
                value = form.name,
                onValueChange = { v -> viewModel.updateNewClient { it.copy(name = v) } },
                singleLine = true,
                shape = FieldShape,
                colors = fieldColors(),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                modifier = Modifier.fillMaxWidth(),
            )
            Label(R.string.client_phone)
            OutlinedTextField(
                value = form.phone,
                onValueChange = { v -> viewModel.updateNewClient { it.copy(phone = v) } },
                singleLine = true,
                placeholder = { Text(stringResource(R.string.client_phone_hint), color = Muted) },
                shape = FieldShape,
                colors = fieldColors(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .padding(top = 10.dp)
                    .clickable { viewModel.updateNewClient { it.copy(consent = !it.consent) } },
            ) {
                Checkbox(
                    checked = form.consent,
                    onCheckedChange = { checked -> viewModel.updateNewClient { it.copy(consent = checked) } },
                    colors = CheckboxDefaults.colors(checkedColor = Rose),
                )
                Text(stringResource(R.string.client_consent), style = B4UType.Caption, color = Ink)
            }
            form.error?.let {
                Text(stringResource(it), style = B4UType.Caption, color = StatusCancelled.fg, modifier = Modifier.padding(top = 8.dp))
            }
            Box(
                modifier = Modifier
                    .padding(top = 20.dp)
                    .fillMaxWidth()
                    .clip(FieldShape)
                    .background(Rose)
                    .clickable(enabled = !form.saving, onClick = viewModel::saveNewClient)
                    .padding(vertical = 13.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (form.saving) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                } else {
                    Text(stringResource(R.string.form_save), style = B4UType.Button, color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun Label(text: Int, top: androidx.compose.ui.unit.Dp = 12.dp) {
    Text(stringResource(text), style = B4UType.Label, color = Muted, modifier = Modifier.padding(top = top, bottom = 6.dp))
}

@Composable
internal fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Rose,
    unfocusedBorderColor = Border,
    focusedContainerColor = CardBg,
    unfocusedContainerColor = CardBg,
)
