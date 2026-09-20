package com.beauty4you.master.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.beauty4you.master.ui.booking.BookingDetailSheet
import com.beauty4you.master.ui.calendar.CalendarScreen
import com.beauty4you.master.ui.dashboard.DashboardScreen
import com.beauty4you.master.ui.profile.ProfileScreen
import com.beauty4you.master.ui.theme.AppBackground
import com.beauty4you.master.ui.theme.NavBar

private data class TabItem(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val TABS = listOf(
    TabItem(NavRoutes.PANEL, "Panel", Icons.Filled.Dashboard),
    TabItem(NavRoutes.CALENDAR, "Kalendarz", Icons.Filled.CalendarMonth),
    TabItem(NavRoutes.PROFILE, "Profil", Icons.Filled.Person),
)

@Composable
fun MainScaffold(onLoggedOut: () -> Unit) {
    val navController = rememberNavController()
    var selectedAppointmentId by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = AppBackground,
        bottomBar = {
            NavigationBar(containerColor = NavBar) {
                val backStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = backStackEntry?.destination

                TABS.forEach { tab ->
                    val selected = currentDestination?.hierarchy?.any { it.route == tab.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = NavRoutes.PANEL,
            modifier = Modifier.padding(padding),
        ) {
            composable(NavRoutes.PANEL) {
                DashboardScreen(onAppointmentClick = { selectedAppointmentId = it })
            }
            composable(NavRoutes.CALENDAR) {
                CalendarScreen(onAppointmentClick = { selectedAppointmentId = it })
            }
            composable(NavRoutes.PROFILE) {
                ProfileScreen(onLoggedOut = onLoggedOut)
            }
        }
    }

    selectedAppointmentId?.let { id ->
        BookingDetailSheet(appointmentId = id, onDismiss = { selectedAppointmentId = null })
    }
}
