package com.beauty4you.client.ui

import androidx.activity.compose.BackHandler
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.client.R
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.Client
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.EmptyState
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.login.LoginScreen
import com.beauty4you.client.ui.booking.BookingScreen
import com.beauty4you.client.ui.common.IconImageTile
import com.beauty4you.client.ui.screens.BookingsScreen
import com.beauty4you.client.ui.screens.HomeScreen
import com.beauty4you.client.ui.screens.LoyaltyScreen
import com.beauty4you.client.ui.screens.MasterDetailScreen
import com.beauty4you.client.ui.screens.NewsScreen
import com.beauty4you.client.ui.screens.ProfileScreen
import com.beauty4you.client.ui.screens.PhotoViewerOverlay
import com.beauty4you.client.ui.screens.ServiceDetailScreen
import com.beauty4you.client.ui.screens.ServicesScreen
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.AppBackground
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.PillShape
import kotlinx.coroutines.delay

private data class TabItem(val tab: Tab, @StringRes val label: Int, @DrawableRes val icon: Int)

private val TABS = listOf(
    TabItem(Tab.NEWS, R.string.tab_news, R.drawable.ic_mail),
    TabItem(Tab.HOME, R.string.tab_home, R.drawable.ic_clock),
    TabItem(Tab.SERVICES, R.string.tab_services, R.drawable.ic_service),
    TabItem(Tab.BOOKINGS, R.string.tab_bookings, R.drawable.ic_calendar),
    TabItem(Tab.PROFILE, R.string.tab_profile, R.drawable.ic_profile),
)

private const val TOAST_DURATION_MS = 2200L

/** Корень: без токена — экран входа, с токеном — основная часть приложения. */
@Composable
fun ClientRoot(isLoggedIn: Boolean?) {
    when (isLoggedIn) {
        null -> Box(Modifier.fillMaxSize().background(AppBackground)) // DataStore ещё читается
        false -> LoginScreen()
        true -> ClientApp()
    }
}

@Composable
fun ClientApp(vm: ClientViewModel = viewModel(factory = ClientViewModel.Factory)) {
    val load by vm.load.collectAsStateWithLifecycle()
    val catalog by vm.catalog.collectAsStateWithLifecycle()
    val client by vm.client.collectAsStateWithLifecycle()

    // Вход в основную часть (первый запуск или повторный вход после выхода) — грузим данные
    LaunchedEffect(Unit) { vm.start() }

    val currentCatalog = catalog
    val currentClient = client
    when {
        load is LoadState.Failed -> ErrorScreen((load as LoadState.Failed).message, onRetry = vm::reload)
        load is LoadState.Loading || currentCatalog == null || currentClient == null -> LoadingScreen()
        else -> MainContent(vm, currentCatalog, currentClient)
    }
}

@Composable
private fun MainContent(vm: ClientViewModel, catalog: Catalog, client: Client) {
    val nav by vm.nav.collectAsStateWithLifecycle()
    val draft by vm.draft.collectAsStateWithLifecycle()
    val toast by vm.toast.collectAsStateWithLifecycle()
    val viewer by vm.viewer.collectAsStateWithLifecycle()

    BackHandler(enabled = nav.pushed != null) { vm.back() }
    // Объявлен позже — при открытой записи «Назад» закрывает её и возвращает туда, откуда пришли
    BackHandler(enabled = draft != null) { vm.closeBooking() }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .background(AppBackground)
                .statusBarsPadding(),
        ) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                val currentDraft = draft
                // Запись — полноэкранный экран поверх вкладки/pushed-экрана; nav не трогаем, чтобы вернуться туда же
                if (currentDraft != null) {
                    BookingScreen(vm, catalog, currentDraft)
                } else when (val pushed = nav.pushed) {
                    is Pushed.MasterDetail -> MasterDetailScreen(vm, catalog, pushed.masterId)
                    is Pushed.ServiceDetail -> ServiceDetailScreen(vm, catalog, pushed.serviceId)
                    Pushed.Loyalty -> LoyaltyScreen(vm)
                    null -> when (nav.tab) {
                        Tab.NEWS -> NewsScreen(vm)
                        Tab.HOME -> HomeScreen(vm, catalog, client)
                        Tab.SERVICES -> ServicesScreen(vm, catalog)
                        Tab.BOOKINGS -> BookingsScreen(vm)
                        Tab.PROFILE -> ProfileScreen(vm, client)
                    }
                }

                ToastHost(
                    toast,
                    onTimeout = vm::clearToast,
                    // На экране записи — над закреплённой панелью с итогом и кнопкой
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = if (draft != null) 124.dp else 0.dp),
                )
            }

            if (draft == null) BottomBar(activeTab = nav.tab, onSelect = vm::selectTab)
        }
        // Просмотр фото — поверх всего окна, включая зоны системных панелей
        viewer?.let { PhotoViewerOverlay(vm, it) }
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize().background(AppBackground), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Accent)
    }
}

@Composable
private fun ErrorScreen(@StringRes message: Int, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(AppBackground).padding(PagePadding),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        EmptyState(stringResource(message), stringResource(R.string.error_generic))
        Spacer(Modifier.height(16.dp))
        AccentButton(stringResource(R.string.retry), onClick = onRetry, large = true)
    }
}

@Composable
private fun BottomBar(activeTab: Tab, onSelect: (Tab) -> Unit) {
    Column(Modifier.background(CardBg).navigationBarsPadding()) {
        HorizontalDivider(color = Border)
        Row(Modifier.padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 12.dp)) {
            TABS.forEach { item ->
                val active = item.tab == activeTab
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) { onSelect(item.tab) }
                        .padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // В прототипе неактивная иконка "Aktualności" приглушена сильнее (0.5 vs 0.6).
                    val inactiveAlpha = if (item.tab == Tab.NEWS) 0.5f else 0.6f
                    IconImageTile(item.icon, size = 44.dp, shape = androidx.compose.foundation.shape.RoundedCornerShape(6.dp), alpha = if (active) 1f else inactiveAlpha)
                    Text(
                        stringResource(item.label),
                        style = B4UType.NavLabel,
                        color = if (active) Accent else Muted,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ToastHost(toast: Toast?, onTimeout: (Toast) -> Unit, modifier: Modifier) {
    // Держим последний текст, чтобы он не пропадал во время exit-анимации.
    var lastMessage by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(toast) {
        if (toast != null) {
            lastMessage = toast.message
            delay(TOAST_DURATION_MS)
            onTimeout(toast)
        }
    }
    AnimatedVisibility(
        visible = toast != null,
        enter = fadeIn() + slideInVertically { it / 3 },
        exit = fadeOut(),
        modifier = modifier.padding(bottom = 16.dp),
    ) {
        val message = toast?.message ?: lastMessage
        if (message != null) {
            Text(
                stringResource(message),
                style = B4UType.BodyMuted.copy(fontWeight = FontWeight.Medium),
                color = Color.White,
                modifier = Modifier
                    .shadow(12.dp, PillShape)
                    .background(InkStrong, PillShape)
                    .padding(horizontal = 16.dp, vertical = 9.dp),
            )
        }
    }
}
