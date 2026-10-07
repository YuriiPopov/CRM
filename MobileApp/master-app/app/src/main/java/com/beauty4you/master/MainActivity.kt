package com.beauty4you.master

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.beauty4you.master.data.remote.UpdateRequired
import com.beauty4you.master.ui.common.UpdateRequiredScreen
import com.beauty4you.master.ui.common.appContainer
import com.beauty4you.master.ui.login.LoginScreen
import com.beauty4you.master.ui.nav.MainScaffold
import com.beauty4you.master.ui.nav.NavRoutes
import com.beauty4you.master.ui.theme.AppBackground
import com.beauty4you.master.ui.theme.B4UMasterTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            B4UMasterTheme {
                val updateRequired by UpdateRequired.required.collectAsState()
                if (updateRequired) UpdateRequiredScreen() else MasterAppRoot()
            }
        }
    }
}

@Composable
private fun MasterAppRoot() {
    val container = appContainer()
    val isLoggedIn by container.sessionRepository.isLoggedIn.collectAsState(initial = null)

    when (isLoggedIn) {
        null -> Scaffold(containerColor = AppBackground) { padding ->
            Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
        }
        else -> {
            val navController = rememberNavController()

            // Токен истёк/сервер вернул 401 (см. SessionRepository.logout, вызываемый
            // ViewModel'ями при HttpException 401) — возвращаем на экран логина.
            androidx.compose.runtime.LaunchedEffect(isLoggedIn) {
                if (isLoggedIn == false) {
                    navController.navigate(NavRoutes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }

            NavHost(
                navController = navController,
                startDestination = if (isLoggedIn == true) NavRoutes.MAIN else NavRoutes.LOGIN,
            ) {
                composable(NavRoutes.LOGIN) {
                    LoginScreen(onLoggedIn = {
                        navController.navigate(NavRoutes.MAIN) {
                            popUpTo(NavRoutes.LOGIN) { inclusive = true }
                        }
                    })
                }
                composable(NavRoutes.MAIN) {
                    MainScaffold(onLoggedOut = {
                        navController.navigate(NavRoutes.LOGIN) {
                            popUpTo(NavRoutes.MAIN) { inclusive = true }
                        }
                    })
                }
            }
        }
    }
}
