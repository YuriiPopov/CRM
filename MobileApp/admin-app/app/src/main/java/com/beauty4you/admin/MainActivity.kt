package com.beauty4you.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.beauty4you.admin.data.remote.UpdateRequired
import com.beauty4you.admin.ui.common.UpdateRequiredScreen
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.login.LoginScreen
import com.beauty4you.admin.ui.nav.MainScaffold
import com.beauty4you.admin.ui.theme.AppBackground
import com.beauty4you.admin.ui.theme.B4UAdminTheme
import com.beauty4you.admin.ui.theme.Rose

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            B4UAdminTheme {
                val updateRequired by UpdateRequired.required.collectAsState()
                if (updateRequired) UpdateRequiredScreen() else AdminAppRoot()
            }
        }
    }
}

// Корень переключается по наличию токена: вход сохраняет токен, выход и любой 401 (см.
// AuthInterceptor) его очищают — экран входа появляется автоматически.
@Composable
private fun AdminAppRoot() {
    val container = appContainer()
    val isLoggedIn by container.sessionRepository.isLoggedIn.collectAsState(initial = null)

    when (isLoggedIn) {
        null -> Box(Modifier.fillMaxSize().background(AppBackground), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Rose)
        }
        false -> LoginScreen()
        true -> MainScaffold()
    }
}
