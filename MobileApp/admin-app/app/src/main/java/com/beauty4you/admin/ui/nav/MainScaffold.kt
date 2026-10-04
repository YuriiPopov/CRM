package com.beauty4you.admin.ui.nav

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.beauty4you.admin.CalendarRequest
import com.beauty4you.admin.R
import com.beauty4you.admin.domain.Booking
import com.beauty4you.admin.domain.BookingStatus
import com.beauty4you.admin.ui.calendar.CalendarScreen
import com.beauty4you.admin.ui.clients.ClientDetailScreen
import com.beauty4you.admin.ui.clients.ClientsScreen
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.dashboard.DashboardScreen
import com.beauty4you.admin.ui.form.BookingFormSheet
import com.beauty4you.admin.ui.form.FormRequest
import com.beauty4you.admin.ui.more.MastersScreen
import com.beauty4you.admin.ui.more.MoreScreen
import com.beauty4you.admin.ui.more.NewsStubScreen
import com.beauty4you.admin.ui.more.ServicesScreen
import com.beauty4you.admin.ui.theme.AppBackground
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.InkStrong
import com.beauty4you.admin.ui.theme.NavBar
import com.beauty4you.admin.ui.theme.PillShape
import kotlinx.coroutines.delay
import java.time.LocalDate

private object Routes {
    const val TAB_PANEL = "tab_panel"
    const val TAB_CALENDAR = "tab_calendar"
    const val TAB_CLIENTS = "tab_clients"
    const val TAB_MORE = "tab_more"

    const val PANEL = "panel"
    const val CALENDAR = "calendar"
    const val CLIENTS = "clients"
    const val CLIENT_DETAIL = "client/{id}"
    const val MORE = "more"
    const val MASTERS = "masters"
    const val SERVICES = "services"
    const val NEWS = "news"

    fun clientDetail(id: String) = "client/$id"
}

private data class TabItem(val route: String, val label: Int, val icon: ImageVector)

private val TABS = listOf(
    TabItem(Routes.TAB_PANEL, R.string.nav_panel, Icons.Filled.Dashboard),
    TabItem(Routes.TAB_CALENDAR, R.string.nav_calendar, Icons.Filled.CalendarMonth),
    TabItem(Routes.TAB_CLIENTS, R.string.nav_clients, Icons.Filled.People),
    TabItem(Routes.TAB_MORE, R.string.nav_more, Icons.Filled.MoreHoriz),
)

private fun NavController.openTab(route: String) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
fun MainScaffold() {
    val container = appContainer()
    val navController = rememberNavController()
    var formRequest by remember { mutableStateOf<FormRequest?>(null) }
    var toast by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) {
        container.events.toasts.collect { toast = it }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2200)
            toast = null
        }
    }

    val openBooking: (Booking) -> Unit = { formRequest = FormRequest(original = it) }

    Scaffold(
        containerColor = AppBackground,
        bottomBar = {
            NavigationBar(containerColor = NavBar) {
                val backStackEntry by navController.currentBackStackEntryAsState()
                val destination = backStackEntry?.destination
                TABS.forEach { tab ->
                    val selected = destination?.hierarchy?.any { it.route == tab.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = { navController.openTab(tab.route) },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = { Text(stringResource(tab.label), style = B4UType.Pill.copy(fontSize = 10.5.sp)) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.White,
                            selectedTextColor = Color.White,
                            unselectedIconColor = Color.White.copy(alpha = 0.6f),
                            unselectedTextColor = Color.White.copy(alpha = 0.65f),
                            indicatorColor = Color.White.copy(alpha = 0.18f),
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            NavHost(navController = navController, startDestination = Routes.TAB_PANEL) {
                navigation(startDestination = Routes.PANEL, route = Routes.TAB_PANEL) {
                    composable(Routes.PANEL) {
                        DashboardScreen(
                            onOpenBooking = openBooking,
                            onOpenPending = { date ->
                                container.events.requestCalendar(CalendarRequest(BookingStatus.CREATED, date))
                                navController.openTab(Routes.TAB_CALENDAR)
                            },
                        )
                    }
                }
                navigation(startDestination = Routes.CALENDAR, route = Routes.TAB_CALENDAR) {
                    composable(Routes.CALENDAR) {
                        CalendarScreen(
                            onOpenBooking = openBooking,
                            onCreateBooking = { date: LocalDate -> formRequest = FormRequest(date = date) },
                        )
                    }
                }
                navigation(startDestination = Routes.CLIENTS, route = Routes.TAB_CLIENTS) {
                    composable(Routes.CLIENTS) {
                        ClientsScreen(onOpenClient = { navController.navigate(Routes.clientDetail(it)) })
                    }
                    composable(
                        Routes.CLIENT_DETAIL,
                        arguments = listOf(navArgument("id") { type = NavType.StringType }),
                    ) { entry ->
                        ClientDetailScreen(
                            clientId = entry.arguments?.getString("id").orEmpty(),
                            onBack = { navController.popBackStack() },
                            onOpenBooking = openBooking,
                        )
                    }
                }
                navigation(startDestination = Routes.MORE, route = Routes.TAB_MORE) {
                    composable(Routes.MORE) {
                        MoreScreen(
                            onOpenMasters = { navController.navigate(Routes.MASTERS) },
                            onOpenServices = { navController.navigate(Routes.SERVICES) },
                            onOpenNews = { navController.navigate(Routes.NEWS) },
                        )
                    }
                    composable(Routes.MASTERS) { MastersScreen(onBack = { navController.popBackStack() }) }
                    composable(Routes.SERVICES) { ServicesScreen(onBack = { navController.popBackStack() }) }
                    composable(Routes.NEWS) { NewsStubScreen(onBack = { navController.popBackStack() }) }
                }
            }

            AnimatedVisibility(
                visible = toast != null,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 20.dp),
            ) {
                val message = toast
                if (message != null) {
                    Text(
                        text = stringResource(message),
                        color = Color.White,
                        style = B4UType.Caption.copy(fontSize = 12.5.sp),
                        modifier = Modifier
                            .background(InkStrong, PillShape)
                            .padding(horizontal = 16.dp, vertical = 9.dp),
                    )
                }
            }
        }
    }

    formRequest?.let { request ->
        BookingFormSheet(request = request, onDismiss = { formRequest = null })
    }
}
